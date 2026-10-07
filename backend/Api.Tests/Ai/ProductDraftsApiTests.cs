using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PetGest.Api.Models;
using PetGest.Api.Services.Ai;
using PetGest.Api.Tests.Auth;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Ai;

// Spec api-product-drafts (T-19 foto, T-20 voz), pela API, com um extrator falso no lugar
// da OpenAI: disponibilidade, arquivo recebido, rascunho e produto salvo com a resposta
// bruta da IA.
[Collection(DatabaseCollection.Name)]
public class ProductDraftsApiTests(DatabaseFixture fixture) : IDisposable
{
    private sealed class FakeExtractor : IProductDraftExtractor
    {
        public bool IsConfigured { get; set; } = true;
        public bool Fail { get; set; }
        public int Calls { get; private set; }

        public Task<ExtractedDraft> FromImageAsync(byte[] image, string contentType, CancellationToken ct) =>
            Respond(null);

        public Task<ExtractedDraft> FromAudioAsync(byte[] audio, string contentType, CancellationToken ct) =>
            Respond("ração golden quinze quilos cento e oitenta e nove e noventa");

        private Task<ExtractedDraft> Respond(string? transcript)
        {
            Calls++;
            if (Fail)
            {
                throw new AiExtractionException("fora do ar (teste)");
            }
            var raw = JsonDocument.Parse($$"""{"provider":"fake","output":{"name":"Ração Golden 15kg"},"transcript":{{JsonSerializer.Serialize(transcript)}}}""");
            return Task.FromResult(new ExtractedDraft("Ração Golden 15kg", "Ração", transcript is null ? null : 189.90m, "7891000315507", transcript, raw));
        }
    }

    private readonly FakeExtractor _extractor = new();
    private AuthApi? _api;

    private AuthApi Api(IReadOnlyDictionary<string, string?>? settings = null) =>
        _api ??= new AuthApi(fixture, settings, configureServices: services =>
        {
            services.RemoveAll<IProductDraftExtractor>();
            services.AddSingleton<IProductDraftExtractor>(_extractor);
        });

    public void Dispose() => _api?.Dispose();

    private async Task<HttpResponseMessage> Upload(string path, string? token, string field, byte[] content, string contentType)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        form.Add(file, field, field == "image" ? "foto.jpg" : "audio.webm");
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = form };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await Api().Client.SendAsync(request);
    }

    private Task<HttpResponseMessage> Photo(string? token, string contentType = "image/jpeg", int size = 100) =>
        Upload("/products/drafts/photo", token, "image", new byte[size], contentType);

    private Task<HttpResponseMessage> Voice(string? token, string contentType = "audio/webm;codecs=opus") =>
        Upload("/products/drafts/voice", token, "audio", new byte[100], contentType);

    private static string PetshopOf(string token) => AuthApi.Decode(token).GetClaim("petshop_id").Value;

    [Fact]
    public async Task Disponibilidade_segue_a_configuracao_do_provedor()
    {
        var token = (await Api().SignupAsync()).AccessToken;
        var on = await AuthApi.ReadAsync<DraftAvailabilityResponse>(await Api().SendAsync(HttpMethod.Get, "/products/drafts/availability", token));
        _extractor.IsConfigured = false;
        var off = await AuthApi.ReadAsync<DraftAvailabilityResponse>(await Api().SendAsync(HttpMethod.Get, "/products/drafts/availability", token));

        Assert.Equal(new DraftAvailabilityResponse(true, true), on);
        Assert.Equal(new DraftAvailabilityResponse(false, false), off);
    }

    [Fact]
    public async Task Sem_chave_configurada_a_api_real_diz_indisponivel()
    {
        using var api = new AuthApi(fixture);
        var token = (await api.SignupAsync()).AccessToken;

        var availability = await AuthApi.ReadAsync<DraftAvailabilityResponse>(await api.SendAsync(HttpMethod.Get, "/products/drafts/availability", token));
        using var form = new MultipartFormDataContent { { new ByteArrayContent([1]) { Headers = { ContentType = new MediaTypeHeaderValue("image/jpeg") } }, "image", "f.jpg" } };
        using var request = new HttpRequestMessage(HttpMethod.Post, "/products/drafts/photo") { Content = form };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var photo = await api.Client.SendAsync(request);

        Assert.Equal(new DraftAvailabilityResponse(false, false), availability);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, photo.StatusCode);
        Assert.Equal("ai_unavailable", await AuthApi.ReadCodeAsync(photo));
    }

    [Fact]
    public async Task Foto_vira_rascunho_e_o_produto_salvo_guarda_a_resposta_bruta()
    {
        var token = (await Api().SignupAsync()).AccessToken;

        var suggestion = await AuthApi.ReadAsync<ProductSuggestionResponse>(await Photo(token));
        Assert.Equal("photo_ai", suggestion.Source);
        Assert.Equal("Ração Golden 15kg", suggestion.Name);
        Assert.Equal("Ração", suggestion.Category);
        Assert.Null(suggestion.Price);
        Assert.Equal("7891000315507", suggestion.Ean);

        // O usuário confere, completa o preço e salva.
        var created = await AuthApi.ReadAsync<ProductResponse>(await Api().SendAsync(HttpMethod.Post, "/products", token, new
        {
            name = suggestion.Name,
            category = suggestion.Category,
            price = 189.90m,
            ean = suggestion.Ean,
            source = suggestion.Source,
            draftId = suggestion.DraftId,
        }), HttpStatusCode.Created);

        Assert.Equal("photo_ai", created.Source);
        await using var db = fixture.Anonymous();
        var stored = await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == created.Id);
        Assert.NotNull(stored.AiRawResponse);
        Assert.Equal("fake", stored.AiRawResponse!.RootElement.GetProperty("provider").GetString());
    }

    [Fact]
    public async Task Voz_traz_a_transcricao_e_o_preco_falado()
    {
        var token = (await Api().SignupAsync()).AccessToken;

        var suggestion = await AuthApi.ReadAsync<ProductSuggestionResponse>(await Voice(token));

        Assert.Equal("voice_ai", suggestion.Source);
        Assert.Equal(189.90m, suggestion.Price);
        Assert.Equal("ração golden quinze quilos cento e oitenta e nove e noventa", suggestion.Transcript);
    }

    [Fact]
    public async Task Rascunho_de_outra_loja_ou_de_outra_origem_nao_entra_no_produto()
    {
        var tokenA = (await Api().SignupAsync()).AccessToken;
        var tokenB = (await Api().SignupAsync()).AccessToken;
        var draftA = await AuthApi.ReadAsync<ProductSuggestionResponse>(await Photo(tokenA));

        var fromB = await AuthApi.ReadAsync<ProductResponse>(await Api().SendAsync(HttpMethod.Post, "/products", tokenB, new
        {
            name = "X", category = "Ração", price = 1, source = "photo_ai", draftId = draftA.DraftId,
        }), HttpStatusCode.Created);
        var wrongSource = await AuthApi.ReadAsync<ProductResponse>(await Api().SendAsync(HttpMethod.Post, "/products", tokenA, new
        {
            name = "Y", category = "Ração", price = 1, source = "voice_ai", draftId = draftA.DraftId,
        }), HttpStatusCode.Created);

        await using var db = fixture.Anonymous();
        Assert.Null((await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == fromB.Id)).AiRawResponse);
        Assert.Null((await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == wrongSource.Id)).AiRawResponse);
        Assert.Equal(PetshopOf(tokenB), (await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == fromB.Id)).PetshopId.ToString());
    }

    [Fact]
    public async Task Rascunho_so_vale_para_um_produto()
    {
        var token = (await Api().SignupAsync()).AccessToken;
        var draft = await AuthApi.ReadAsync<ProductSuggestionResponse>(await Photo(token));
        object Body(string name) => new { name, category = "Ração", price = 1, source = "photo_ai", draftId = draft.DraftId };

        var first = await AuthApi.ReadAsync<ProductResponse>(await Api().SendAsync(HttpMethod.Post, "/products", token, Body("Primeiro")), HttpStatusCode.Created);
        var second = await AuthApi.ReadAsync<ProductResponse>(await Api().SendAsync(HttpMethod.Post, "/products", token, Body("Segundo")), HttpStatusCode.Created);

        await using var db = fixture.Anonymous();
        Assert.NotNull((await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == first.Id)).AiRawResponse);
        Assert.Null((await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == second.Id)).AiRawResponse);
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("image/heic")]
    [InlineData("application/pdf")]
    public async Task Formato_de_imagem_nao_aceito_e_recusado_sem_chamar_a_ia(string contentType)
    {
        var token = (await Api().SignupAsync()).AccessToken;

        var response = await Photo(token, contentType);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_file", await AuthApi.ReadCodeAsync(response));
        Assert.Equal(0, _extractor.Calls);
    }

    [Fact]
    public async Task Arquivo_acima_do_limite_e_recusado()
    {
        var token = (await Api(new Dictionary<string, string?> { ["Ai:MaxImageBytes"] = "50" }).SignupAsync()).AccessToken;

        var response = await Photo(token, size: 51);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_file", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Envio_sem_arquivo_e_recusado()
    {
        var token = (await Api().SignupAsync()).AccessToken;
        using var request = new HttpRequestMessage(HttpMethod.Post, "/products/drafts/photo")
        {
            Content = new MultipartFormDataContent { { new StringContent("x"), "outro" } },
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await Api().Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Falha_do_provedor_responde_502()
    {
        var token = (await Api().SignupAsync()).AccessToken;
        _extractor.Fail = true;

        var response = await Voice(token);

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("ai_failed", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Sem_token_e_recusado()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Photo(null)).StatusCode);
        Assert.Equal(0, _extractor.Calls);
    }

    [Fact]
    public async Task Limite_de_uso_e_por_usuario()
    {
        var api = Api(new Dictionary<string, string?> { ["RateLimit:Ai:PermitLimit"] = "2" });
        var tokenA = (await api.SignupAsync()).AccessToken;
        var tokenB = (await api.SignupAsync()).AccessToken;

        var a = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            a.Add((await Photo(tokenA)).StatusCode);
        }
        var b = (await Photo(tokenB)).StatusCode;

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], a);
        Assert.Equal(HttpStatusCode.OK, b);
    }
}
