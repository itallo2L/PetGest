namespace PetGest.Api.Services;

// Seção "Email" (design D1 da T-22). A connection string do Communication Services é
// segredo: só nas configurações do App Service (variável Email__AcsConnectionString).
public class EmailSettings
{
    public const string Section = "Email";
    public const string LogProvider = "log";
    public const string AcsProvider = "acs";

    public string Provider { get; set; } = LogProvider;

    // "endpoint=https://<recurso>.communication.azure.com/;accesskey=<chave em base64>"
    public string AcsConnectionString { get; set; } = "";

    // Endereço do domínio verificado no recurso de e-mail, ex.: DoNotReply@<id>.azurecomm.net
    public string Sender { get; set; } = "";

    // Falha na inicialização, como a string de conexão e a chave JWT: configuração
    // incompleta não pode virar e-mail perdido em silêncio.
    public static void Validate(IConfiguration configuration, IHostEnvironment environment)
    {
        var settings = configuration.GetSection(Section).Get<EmailSettings>() ?? new EmailSettings();
        var provider = settings.Provider.Trim().ToLowerInvariant();

        if (provider == AcsProvider)
        {
            if (!AcsConnection.TryParse(settings.AcsConnectionString, out _))
            {
                throw new InvalidOperationException(
                    "Email:Provider=acs exige 'Email:AcsConnectionString' no formato " +
                    "'endpoint=https://<recurso>.communication.azure.com/;accesskey=<chave>' (variável Email__AcsConnectionString).");
            }
            if (string.IsNullOrWhiteSpace(settings.Sender))
            {
                throw new InvalidOperationException(
                    "Email:Provider=acs exige 'Email:Sender' (ex.: DoNotReply@<domínio>.azurecomm.net; variável Email__Sender).");
            }
            return;
        }

        if (provider != LogProvider)
        {
            throw new InvalidOperationException(
                $"Email:Provider inválido: '{settings.Provider}'. Valores aceitos: {LogProvider}, {AcsProvider}.");
        }

        // Com a confirmação exigida, e-mail só no log trancaria toda conta nova do lado de
        // fora. Em desenvolvimento o link é copiado do console, então lá é permitido.
        if (!environment.IsDevelopment() && configuration.GetValue<bool>($"{AuthSettings.Section}:RequireConfirmedEmail"))
        {
            throw new InvalidOperationException(
                "Auth:RequireConfirmedEmail=true fora de Development exige envio real de e-mail: configure Email:Provider=acs.");
        }
    }
}
