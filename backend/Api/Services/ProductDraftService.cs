using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;
using PetGest.Api.Services.Ai;

namespace PetGest.Api.Services;

public static class DraftErrorCodes
{
    public const string AiUnavailable = "ai_unavailable";
    public const string AiFailed = "ai_failed";
    public const string InvalidFile = "invalid_file";
}

// Rascunho guardado entre a sugestão da IA e o produto salvo (design D4 da T-19).
public record StoredDraft(Guid PetshopId, ProductSource Source, JsonDocument Raw);

// Cadastro por foto e por voz (T-19, T-20): valida o arquivo, chama o extrator e devolve
// um rascunho para o mesmo formulário de cadastro, que o usuário confere antes de salvar.
public class ProductDraftService(
    IProductDraftExtractor extractor,
    IMemoryCache cache,
    ITenantContext tenant,
    IOptions<AiSettings> options,
    ILogger<ProductDraftService> logger)
{
    private static readonly ApiError Unavailable = new(StatusCodes.Status503ServiceUnavailable, DraftErrorCodes.AiUnavailable,
        "O cadastro por foto e por voz não está disponível agora.");

    private static readonly ApiError Failed = new(StatusCodes.Status502BadGateway, DraftErrorCodes.AiFailed,
        "Não foi possível ler o produto agora. Tente de novo ou preencha à mão.");

    private static readonly ApiError PetshopRequired = new(StatusCodes.Status403Forbidden, ProductErrorCodes.PetshopRequired,
        "Conclua o cadastro da loja antes de cadastrar produtos.");

    // Formatos de imagem que o modelo lê. HEIC (iPhone) não: o frontend converte para JPEG.
    private static readonly HashSet<string> ImageTypes = ["image/jpeg", "image/png", "image/webp"];

    private static readonly HashSet<string> AudioTypes =
        ["audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];

    private AiSettings Settings => options.Value;

    public DraftAvailabilityResponse Availability() => new(extractor.IsConfigured, extractor.IsConfigured);

    public Task<ApiResult<ProductSuggestionResponse>> FromPhotoAsync(IFormFile? image, CancellationToken ct) =>
        ExtractAsync(image, "image", ImageTypes, Settings.MaxImageBytes, ProductSource.PhotoAI,
            (bytes, type) => extractor.FromImageAsync(bytes, type, ct), ct);

    public Task<ApiResult<ProductSuggestionResponse>> FromVoiceAsync(IFormFile? audio, CancellationToken ct) =>
        ExtractAsync(audio, "audio", AudioTypes, Settings.MaxAudioBytes, ProductSource.VoiceAI,
            (bytes, type) => extractor.FromAudioAsync(bytes, type, ct), ct);

    // Resposta bruta do rascunho, se ele é desta loja e da mesma origem; consumida uma vez.
    public JsonDocument? TakeRaw(Guid? draftId, ProductSource source)
    {
        if (draftId is not { } id || !cache.TryGetValue(Key(id), out StoredDraft? draft) || draft is null)
        {
            return null;
        }
        if (draft.PetshopId != tenant.PetshopId || draft.Source != source)
        {
            return null;
        }
        cache.Remove(Key(id));
        return draft.Raw;
    }

    private async Task<ApiResult<ProductSuggestionResponse>> ExtractAsync(
        IFormFile? file,
        string field,
        HashSet<string> allowedTypes,
        int maxBytes,
        ProductSource source,
        Func<byte[], string, Task<ExtractedDraft>> extract,
        CancellationToken ct)
    {
        if (tenant.PetshopId is not { } petshopId)
        {
            return PetshopRequired;
        }
        if (!extractor.IsConfigured)
        {
            return Unavailable;
        }

        var contentType = file?.ContentType?.Split(';')[0].Trim().ToLowerInvariant() ?? "";
        if (file is null || file.Length == 0)
        {
            return InvalidFile(field, "Envie o arquivo no campo '" + field + "'.");
        }
        if (file.Length > maxBytes)
        {
            return InvalidFile(field, $"O arquivo passa do limite de {maxBytes / (1024 * 1024)} MB.");
        }
        if (!allowedTypes.Contains(contentType))
        {
            return InvalidFile(field, $"Formato não aceito: '{contentType}'.");
        }

        byte[] bytes;
        await using (var stream = file.OpenReadStream())
        using (var buffer = new MemoryStream((int)file.Length))
        {
            await stream.CopyToAsync(buffer, ct);
            bytes = buffer.ToArray();
        }

        ExtractedDraft draft;
        try
        {
            draft = await extract(bytes, contentType);
        }
        catch (AiExtractionException ex)
        {
            logger.LogWarning(ex, "Falha na extração por IA ({Source}).", source.ToWire());
            return Failed;
        }

        var draftId = Guid.NewGuid();
        cache.Set(Key(draftId), new StoredDraft(petshopId, source, draft.Raw), TimeSpan.FromMinutes(Settings.DraftLifetimeMinutes));

        return new ProductSuggestionResponse(
            draftId, source.ToWire(), draft.Name, draft.Category, draft.Price, draft.Ean, draft.Transcript);
    }

    private static ApiError InvalidFile(string field, string message) =>
        ApiError.Validation(DraftErrorCodes.InvalidFile, "Arquivo inválido.", field, message);

    private static string Key(Guid draftId) => $"product-draft:{draftId}";
}
