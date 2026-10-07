using System.ComponentModel.DataAnnotations;

namespace PetGest.Api.Models;

// Contratos de /auth (spec api-auth). O formato fica aqui; a regra de senha é do
// Identity (mínimo de 6 caracteres) e volta como `weak_password`.

public record SignupRequest(
    [property: Required, EmailAddress, MaxLength(256)] string Email,
    [property: Required] string Password,
    [property: Required, MaxLength(200)] string PetshopName,
    [property: Required, EmailAddress, MaxLength(256)] string PetshopEmail,
    [property: MaxLength(40)] string? PetshopPhone);

public record LoginRequest(
    [property: Required] string Email,
    [property: Required] string Password);

public record RefreshRequest([property: Required] string RefreshToken);

public record LogoutRequest([property: Required] string RefreshToken);

public record ConfirmEmailRequest(
    [property: Required] Guid UserId,
    [property: Required] string Code);

// Recuperação de senha e reenvio da confirmação (T-22). As respostas não dizem se existe
// conta com o e-mail.
public record ForgotPasswordRequest([property: Required, MaxLength(256)] string Email);

public record ResetPasswordRequest(
    [property: Required] Guid UserId,
    [property: Required] string Code,
    [property: Required] string Password);

public record ResendConfirmationRequest([property: Required, MaxLength(256)] string Email);

// Sessão devolvida por cadastro, login e renovação.
public record SessionResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

public record MeResponse(Guid UserId, string Email, bool EmailConfirmed, Guid? PetshopId);
