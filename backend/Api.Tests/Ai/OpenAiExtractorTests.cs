using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using PetGest.Api.Services.Ai;

namespace PetGest.Api.Tests.Ai;

// Adaptador da OpenAI contra um servidor falso (design D1/D2 da T-19; T-20): o formato das
// requisições e a leitura das respostas, sem rede e sem chave.
public class OpenAiExtractorTests
{
    private sealed record Sent(string Path, string? Authorization, string ContentType, string Body);

    private sealed class FakeOpenAi(Func<string, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<Sent> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            Requests.Add(new Sent(
                request.RequestUri!.AbsolutePath,
                request.Headers.Authorization?.ToString(),
                request.Content?.Headers.ContentType?.MediaType ?? "",
                body));
            return respond(request.RequestUri.AbsolutePath);
        }
    }

    private static HttpResponseMessage Chat(object fields, string? refusal = null) => Json(new
    {
        choices = new[]
        {
            new { message = new { content = refusal is null ? JsonSerializer.Serialize(fields) : null, refusal } },
        },
        usage = new { prompt_tokens = 1200, completion_tokens = 40, total_tokens = 1240 },
    });

    private static HttpResponseMessage Json(object body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };

    private static (OpenAiProductDraftExtractor Extractor, FakeOpenAi Server) Create(Func<string, HttpResponseMessage> respond)
    {
        var server = new FakeOpenAi(respond);
        var settings = Options.Create(new AiSettings { OpenAI = new OpenAiSettings { ApiKey = "sk-teste" } });
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 7, 4, 0, 0, TimeSpan.Zero));
        return (new OpenAiProductDraftExtractor(new HttpClient(server), settings, time), server);
    }

    [Fact]
    public async Task Foto_vai_como_imagem_com_esquema_estrito_e_volta_normalizada()
    {
        var (extractor, server) = Create(_ => Chat(new
        {
            name = "Ração Golden Adultos Frango 15kg",
            category = "racao",
            price = (decimal?)null,
            ean = "7891000315507",
        }));

        var draft = await extractor.FromImageAsync([1, 2, 3], "image/jpeg", CancellationToken.None);

        Assert.Equal("Ração Golden Adultos Frango 15kg", draft.Name);
        Assert.Equal("Ração", draft.Category);
        Assert.Null(draft.Price);
        Assert.Equal("7891000315507", draft.Ean);
        Assert.Null(draft.Transcript);

        var sent = Assert.Single(server.Requests);
        Assert.Equal("/v1/chat/completions", sent.Path);
        Assert.Equal("Bearer sk-teste", sent.Authorization);
        using var request = JsonDocument.Parse(sent.Body);
        var root = request.RootElement;
        Assert.Equal("gpt-4.1-mini", root.GetProperty("model").GetString());
        Assert.Equal("json_schema", root.GetProperty("response_format").GetProperty("type").GetString());
        Assert.True(root.GetProperty("response_format").GetProperty("json_schema").GetProperty("strict").GetBoolean());
        var image = root.GetProperty("messages")[1].GetProperty("content")[1].GetProperty("image_url").GetProperty("url").GetString();
        Assert.Equal("data:image/jpeg;base64,AQID", image);

        var raw = draft.Raw.RootElement;
        Assert.Equal("openai", raw.GetProperty("provider").GetString());
        Assert.Equal("racao", raw.GetProperty("output").GetProperty("category").GetString());
        Assert.Equal(1240, raw.GetProperty("usage").GetProperty("total_tokens").GetInt32());
    }

    [Fact]
    public async Task Voz_transcreve_e_depois_estrutura_o_texto()
    {
        var (extractor, server) = Create(path => path.EndsWith("audio/transcriptions")
            ? Json(new { text = "Petisco Dreamies salmão sessenta gramas, nove e noventa" })
            : Chat(new { name = "Petisco Dreamies Salmão 60g", category = "Petiscos", price = 9.9m, ean = (string?)null }));

        var draft = await extractor.FromAudioAsync([9, 9], "audio/webm;codecs=opus", CancellationToken.None);

        Assert.Equal("Petisco Dreamies Salmão 60g", draft.Name);
        Assert.Equal("Petiscos", draft.Category);
        Assert.Equal(9.90m, draft.Price);
        Assert.Equal("Petisco Dreamies salmão sessenta gramas, nove e noventa", draft.Transcript);

        Assert.Equal(2, server.Requests.Count);
        var transcription = server.Requests[0];
        Assert.Equal("/v1/audio/transcriptions", transcription.Path);
        Assert.Equal("multipart/form-data", transcription.ContentType);
        Assert.Contains("filename=audio.webm", transcription.Body);
        Assert.Contains("gpt-4o-mini-transcribe", transcription.Body);
        Assert.Contains("name=language", transcription.Body);
        using var chat = JsonDocument.Parse(server.Requests[1].Body);
        var prompt = chat.RootElement.GetProperty("messages")[1].GetProperty("content")[0].GetProperty("text").GetString();
        Assert.Contains("Petisco Dreamies salmão sessenta gramas", prompt);
        Assert.Equal("Petisco Dreamies salmão sessenta gramas, nove e noventa",
            draft.Raw.RootElement.GetProperty("transcript").GetString());
    }

    [Fact]
    public async Task Audio_sem_fala_nao_chama_o_modelo()
    {
        var (extractor, server) = Create(_ => Json(new { text = "  " }));

        var draft = await extractor.FromAudioAsync([1], "audio/mp4", CancellationToken.None);

        Assert.Single(server.Requests);
        Assert.Contains("filename=audio.m4a", server.Requests[0].Body);
        Assert.Null(draft.Name);
        Assert.Null(draft.Category);
    }

    [Fact]
    public async Task Erro_ou_recusa_do_provedor_vira_falha_de_extracao()
    {
        var (failing, _) = Create(_ => Json(new { error = new { message = "quota" } }, HttpStatusCode.TooManyRequests));
        var (refusing, _) = Create(_ => Chat(new { }, refusal: "não posso ajudar"));
        var (garbage, _) = Create(_ => Json(new { choices = new[] { new { message = new { content = "isto não é json" } } } }));

        await Assert.ThrowsAsync<AiExtractionException>(() => failing.FromImageAsync([1], "image/png", CancellationToken.None));
        await Assert.ThrowsAsync<AiExtractionException>(() => refusing.FromImageAsync([1], "image/png", CancellationToken.None));
        await Assert.ThrowsAsync<AiExtractionException>(() => garbage.FromImageAsync([1], "image/png", CancellationToken.None));
    }

    [Theory]
    [InlineData("audio/webm;codecs=opus", "webm")]
    [InlineData("audio/mp4", "m4a")]
    [InlineData("audio/ogg", "ogg")]
    [InlineData("audio/mpeg", "mp3")]
    [InlineData("audio/wav", "wav")]
    public void Extensao_do_audio_segue_o_formato(string contentType, string extension) =>
        Assert.Equal(extension, OpenAiProductDraftExtractor.AudioExtension(contentType));
}
