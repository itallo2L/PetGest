namespace PetGest.Api.Services.Ai;

// Seção "Ai" (design D1 da T-19). A chave da OpenAI é segredo: só nas configurações do
// App Service (variável Ai__OpenAI__ApiKey). Sem chave, foto e voz ficam indisponíveis e
// o resto da API funciona normalmente.
public class AiSettings
{
    public const string Section = "Ai";

    public OpenAiSettings OpenAI { get; set; } = new();

    // Tamanho máximo dos arquivos recebidos. O frontend reduz a foto antes de enviar
    // (~300 KB); estes limites só barram abuso.
    public int MaxImageBytes { get; set; } = 8 * 1024 * 1024;
    public int MaxAudioBytes { get; set; } = 10 * 1024 * 1024;

    // Rascunho guardado para anexar a resposta bruta ao produto salvo (design D4).
    public int DraftLifetimeMinutes { get; set; } = 30;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(OpenAI.ApiKey);
}

public class OpenAiSettings
{
    public string ApiKey { get; set; } = "";
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";

    // Modelo multimodal que lê a foto e estrutura o texto da voz; modelo de transcrição
    // para o áudio. Trocáveis por configuração, sem mudar código (design D1). O modelo
    // precisa aceitar imagem, `temperature` e `response_format: json_schema` (famílias
    // gpt-4.1/gpt-4o); modelos de raciocínio recusam `temperature` e dariam `ai_failed`.
    public string Model { get; set; } = "gpt-4.1-mini";
    public string TranscriptionModel { get; set; } = "gpt-4o-mini-transcribe";
    public int TimeoutSeconds { get; set; } = 45;
}

// Seção "RateLimit:Ai": chamadas de IA por usuário, para conter o custo (design D5).
public class AiRateLimitSettings
{
    public const string Section = "RateLimit:Ai";
    public const string PolicyName = "ai";

    public int PermitLimit { get; set; } = 20;
    public int WindowSeconds { get; set; } = 60;
}
