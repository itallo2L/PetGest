using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace PetGest.Api.Services.Ai;

// Adaptador da OpenAI (design D1 e D2 da T-19; T-20 para a voz), pela API REST com
// HttpClient — "só mais um HttpClient" (PLANOMVP.md §4.1) e testável com um
// HttpMessageHandler falso.
// - Foto: Chat Completions com a imagem e saída em JSON Schema estrito.
// - Voz: transcrição do áudio (/audio/transcriptions) e depois o mesmo Chat Completions
//   sobre o texto.
public class OpenAiProductDraftExtractor(HttpClient http, IOptions<AiSettings> options, TimeProvider time)
    : IProductDraftExtractor
{
    public const string Provider = "openai";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    internal const string Instructions = """
        Você ajuda o dono de um petshop no Brasil a cadastrar produtos. A partir do que receber
        (foto da embalagem ou transcrição do que ele falou), preencha os campos do esquema:

        - name: nome do produto como aparece numa prateleira, em português, com marca, linha,
          sabor/variação e tamanho ou peso quando estiverem visíveis ou forem ditos
          (ex.: "Ração Golden Adultos Frango 15kg", "Coleira Nylon M Azul").
        - category: exatamente uma destas — Ração, Medicamento, Higiene, Acessórios, Petiscos,
          Jardinagem, Agropecuário — ou null se nenhuma servir.
        - price: preço de venda em reais, só se aparecer numa etiqueta de preço ou for dito.
          Converta números falados ("cento e oitenta e nove e noventa" = 189.90). Nunca invente
          ou estime um preço: na dúvida, null.
        - ean: os dígitos do código de barras só se estiverem legíveis por completo; senão null.

        Se não houver um produto na foto ou na fala, devolva todos os campos como null.
        """;

    private static readonly JsonObject Schema = new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["name"] = new JsonObject { ["type"] = new JsonArray("string", "null") },
            // A lista de categorias vai nas instruções, não num `enum`: o normalizador
            // descarta o que vier fora dela, e o esquema fica no subconjunto mais simples
            // do modo estrito (tipos com null).
            ["category"] = new JsonObject { ["type"] = new JsonArray("string", "null") },
            ["price"] = new JsonObject { ["type"] = new JsonArray("number", "null") },
            ["ean"] = new JsonObject { ["type"] = new JsonArray("string", "null") },
        },
        ["required"] = new JsonArray("name", "category", "price", "ean"),
        ["additionalProperties"] = false,
    };

    private AiSettings Settings => options.Value;

    public bool IsConfigured => Settings.IsConfigured;

    public async Task<ExtractedDraft> FromImageAsync(byte[] image, string contentType, CancellationToken ct)
    {
        var dataUrl = $"data:{contentType};base64,{Convert.ToBase64String(image)}";
        var userContent = new JsonArray
        {
            new JsonObject { ["type"] = "text", ["text"] = "Foto da embalagem do produto a cadastrar." },
            new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject { ["url"] = dataUrl, ["detail"] = "high" },
            },
        };
        return await StructureAsync(userContent, transcript: null, ct);
    }

    public async Task<ExtractedDraft> FromAudioAsync(byte[] audio, string contentType, CancellationToken ct)
    {
        var transcript = await TranscribeAsync(audio, contentType, ct);
        if (string.IsNullOrWhiteSpace(transcript))
        {
            return Build(null, transcript, null, "");
        }

        var userContent = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "text",
                ["text"] = $"Transcrição do que o dono do petshop falou para cadastrar um produto:\n\"{transcript.Trim()}\"",
            },
        };
        return await StructureAsync(userContent, transcript, ct);
    }

    private async Task<string> TranscribeAsync(byte[] audio, string contentType, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(audio);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        // A OpenAI reconhece o formato pela extensão do nome do arquivo.
        form.Add(file, "file", "audio." + AudioExtension(contentType));
        form.Add(new StringContent(Settings.OpenAI.TranscriptionModel), "model");
        form.Add(new StringContent("pt"), "language");
        form.Add(new StringContent("json"), "response_format");

        using var response = await SendAsync(HttpMethod.Post, "audio/transcriptions", form, ct);
        using var body = await ReadJsonAsync(response, ct);
        return body.RootElement.TryGetProperty("text", out var text) ? text.GetString() ?? "" : "";
    }

    private async Task<ExtractedDraft> StructureAsync(JsonArray userContent, string? transcript, CancellationToken ct)
    {
        var request = new JsonObject
        {
            ["model"] = Settings.OpenAI.Model,
            ["temperature"] = 0,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = Instructions },
                new JsonObject { ["role"] = "user", ["content"] = userContent },
            },
            ["response_format"] = new JsonObject
            {
                ["type"] = "json_schema",
                ["json_schema"] = new JsonObject
                {
                    ["name"] = "product_draft",
                    ["strict"] = true,
                    ["schema"] = Schema.DeepClone(),
                },
            },
        };

        using var content = new StringContent(request.ToJsonString(Json), Encoding.UTF8, "application/json");
        using var response = await SendAsync(HttpMethod.Post, "chat/completions", content, ct);
        using var body = await ReadJsonAsync(response, ct);

        var message = body.RootElement.GetProperty("choices")[0].GetProperty("message");
        if (message.TryGetProperty("refusal", out var refusal) && refusal.ValueKind == JsonValueKind.String)
        {
            throw new AiExtractionException("O modelo recusou a extração: " + refusal.GetString());
        }

        var output = message.GetProperty("content").GetString() ?? "";
        JsonElement fields;
        try
        {
            using var parsed = JsonDocument.Parse(output);
            fields = parsed.RootElement.Clone();
        }
        catch (JsonException ex)
        {
            throw new AiExtractionException("A resposta do modelo não é JSON.", ex);
        }

        var usage = body.RootElement.TryGetProperty("usage", out var u) ? u.Clone() : (JsonElement?)null;
        return Build(fields, transcript, usage, output);
    }

    private ExtractedDraft Build(JsonElement? fields, string? transcript, JsonElement? usage, string output)
    {
        string? Text(string name) =>
            fields is { } f && f.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        decimal? Number(string name) =>
            fields is { } f && f.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)
                ? d
                : null;

        // Resposta bruta guardada no produto (PLANOMVP.md §2.3): o que o modelo devolveu,
        // antes da normalização, com o modelo, a transcrição e o consumo de tokens — base
        // para conferir acerto e custo na T-21. A imagem e o áudio não são guardados.
        var raw = new JsonObject
        {
            ["provider"] = Provider,
            ["model"] = Settings.OpenAI.Model,
            ["capturedAt"] = time.GetUtcNow(),
            ["output"] = fields is { } parsed ? JsonNode.Parse(parsed.GetRawText()) : output.Length == 0 ? null : output,
        };
        if (transcript is not null)
        {
            raw["transcriptionModel"] = Settings.OpenAI.TranscriptionModel;
            raw["transcript"] = transcript;
        }
        if (usage is { } used)
        {
            raw["usage"] = JsonNode.Parse(used.GetRawText());
        }

        return new ExtractedDraft(
            DraftNormalizer.Name(Text("name")),
            DraftNormalizer.Category(Text("category")),
            DraftNormalizer.Price(Number("price")),
            DraftNormalizer.Ean(Text("ean")),
            transcript,
            JsonDocument.Parse(raw.ToJsonString(Json)));
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, HttpContent content, CancellationToken ct)
    {
        var request = new HttpRequestMessage(method, new Uri(new Uri(Settings.OpenAI.BaseUrl.TrimEnd('/') + "/"), path))
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Settings.OpenAI.ApiKey);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(Settings.OpenAI.TimeoutSeconds));
        try
        {
            var response = await http.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                var detail = await response.Content.ReadAsStringAsync(ct);
                response.Dispose();
                throw new AiExtractionException($"OpenAI respondeu {(int)response.StatusCode}: {detail}");
            }
            return response;
        }
        catch (OperationCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new AiExtractionException("A OpenAI não respondeu a tempo.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new AiExtractionException("Não foi possível falar com a OpenAI.", ex);
        }
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        }
        catch (JsonException ex)
        {
            throw new AiExtractionException("Resposta da OpenAI fora do formato esperado.", ex);
        }
    }

    // Formatos que o MediaRecorder gera (Chrome: webm/ogg; Safari: mp4) e os comuns de arquivo.
    public static string AudioExtension(string contentType) =>
        contentType.Split(';')[0].Trim().ToLowerInvariant() switch
        {
            "audio/webm" => "webm",
            "audio/ogg" => "ogg",
            "audio/mp4" or "audio/x-m4a" or "audio/m4a" or "audio/aac" => "m4a",
            "audio/mpeg" or "audio/mp3" => "mp3",
            "audio/wav" or "audio/x-wav" or "audio/wave" => "wav",
            _ => "webm",
        };
}
