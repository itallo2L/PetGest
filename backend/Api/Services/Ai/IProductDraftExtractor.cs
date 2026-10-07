using System.Text.Json;

namespace PetGest.Api.Services.Ai;

// Campos que a IA conseguiu ler, já normalizados (DraftNormalizer): qualquer um pode ser
// null. `Transcript` só existe na voz. `Raw` é o que vai para products.ai_raw_response.
public record ExtractedDraft(
    string? Name,
    string? Category,
    decimal? Price,
    string? Ean,
    string? Transcript,
    JsonDocument Raw);

// Provedor de IA atrás de uma interface (T-11, D6): trocar de provedor é trocar o
// adaptador e a configuração, não o fluxo.
public interface IProductDraftExtractor
{
    bool IsConfigured { get; }

    Task<ExtractedDraft> FromImageAsync(byte[] image, string contentType, CancellationToken ct);

    Task<ExtractedDraft> FromAudioAsync(byte[] audio, string contentType, CancellationToken ct);
}

// Falha do provedor (fora do ar, tempo esgotado, resposta fora do esquema). A API responde
// 502 `ai_failed` e o usuário pode tentar de novo ou preencher à mão.
public class AiExtractionException(string message, Exception? inner = null) : Exception(message, inner);
