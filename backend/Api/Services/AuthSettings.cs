using System.Text;

namespace PetGest.Api.Services;

// Seção "Jwt" (design D3 da T-14). SigningKey é segredo: em desenvolvimento só um valor
// local; nos outros ambientes, a variável Jwt__SigningKey (T-17).
public class JwtSettings
{
    public const string Section = "Jwt";
    public const int MinimumKeyBytes = 32;

    public string Issuer { get; set; } = "petgest-api";
    public string Audience { get; set; } = "petgest-app";
    public string SigningKey { get; set; } = "";

    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    public byte[] SigningKeyBytes => Encoding.UTF8.GetBytes(SigningKey);

    // Falha na inicialização com a chave nomeada, como a string de conexão.
    public static void Validate(IConfiguration configuration)
    {
        var key = configuration[$"{Section}:SigningKey"];
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < MinimumKeyBytes)
        {
            throw new InvalidOperationException(
                $"Chave de assinatura ausente ou curta: configure '{Section}:SigningKey' com pelo menos {MinimumKeyBytes} bytes " +
                "(em desenvolvimento, appsettings.Development.json; nos outros ambientes, a variável Jwt__SigningKey).");
        }
    }
}

// Seção "Auth" (design D6 da T-14).
public class AuthSettings
{
    public const string Section = "Auth";

    // Desligada até a T-18: com ela ligada, conta sem e-mail confirmado não abre sessão.
    public bool RequireConfirmedEmail { get; set; }

    // Base dos links enviados por e-mail (confirmação), que abrem telas do frontend.
    public string FrontendBaseUrl { get; set; } = "http://localhost:5183";
}

// Seção "RateLimit:Auth" (design D8 da T-14).
public class AuthRateLimitSettings
{
    public const string Section = "RateLimit:Auth";
    public const string PolicyName = "auth";

    public int PermitLimit { get; set; } = 10;
    public int WindowSeconds { get; set; } = 60;
}
