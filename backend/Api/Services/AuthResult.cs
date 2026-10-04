namespace PetGest.Api.Services;

// Códigos de erro de /auth (extensão `code` do ProblemDetails) — os nomes que a T-16
// mapeia para as mensagens do frontend (design D5 da T-14).
public static class AuthErrorCodes
{
    public const string EmailTaken = "email_taken";
    public const string WeakPassword = "weak_password";
    public const string InvalidRequest = "invalid_request";
    public const string InvalidCredentials = "invalid_credentials";
    public const string EmailNotConfirmed = "email_not_confirmed";
    public const string InvalidRefreshToken = "invalid_refresh_token";
    public const string InvalidConfirmation = "invalid_confirmation";
}

public static class AuthErrors
{
    public static readonly ApiError InvalidCredentials =
        new(StatusCodes.Status401Unauthorized, AuthErrorCodes.InvalidCredentials, "E-mail ou senha inválidos.");

    public static readonly ApiError EmailNotConfirmed =
        new(StatusCodes.Status403Forbidden, AuthErrorCodes.EmailNotConfirmed, "Confirme o e-mail antes de entrar.");

    public static readonly ApiError InvalidRefreshToken =
        new(StatusCodes.Status401Unauthorized, AuthErrorCodes.InvalidRefreshToken, "Sessão expirada. Entre de novo.");

    public static readonly ApiError InvalidConfirmation =
        new(StatusCodes.Status400BadRequest, AuthErrorCodes.InvalidConfirmation, "Link de confirmação inválido ou expirado.");

    public static readonly ApiError EmailTaken =
        new(StatusCodes.Status409Conflict, AuthErrorCodes.EmailTaken, "Já existe uma conta com este e-mail.");
}
