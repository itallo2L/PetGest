using PetGest.Api.Data;
using PetGest.Api.Models;
using PetGest.Api.Services;

namespace PetGest.Api.Endpoints;

// /auth (spec api-auth). Só /auth/me exige token; os demais abrem ou encerram sessão ou
// tratam dos links enviados por e-mail e são públicos — todos, menos renovação e logout,
// com limite de tentativas (design D8 da T-14; T-22).
public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/signup", async (SignupRequest request, AuthService auth, CancellationToken ct) =>
            {
                var result = await auth.SignupAsync(request, ct);
                return result.Error?.ToResult() ?? Results.Created("/auth/me", ToResponse(result.Value!));
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("Signup")
            .Produces<SessionResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapPost("/login", async (LoginRequest request, AuthService auth, CancellationToken ct) =>
            {
                var result = await auth.LoginAsync(request, ct);
                return result.Error?.ToResult() ?? Results.Ok(ToResponse(result.Value!));
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("Login")
            .Produces<SessionResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapPost("/refresh", async (RefreshRequest request, AuthService auth, CancellationToken ct) =>
            {
                var result = await auth.RefreshAsync(request, ct);
                return result.Error?.ToResult() ?? Results.Ok(ToResponse(result.Value!));
            })
            .AllowAnonymous()
            .WithName("RefreshSession")
            .Produces<SessionResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden);

        group.MapPost("/logout", async (LogoutRequest request, AuthService auth, CancellationToken ct) =>
            {
                await auth.LogoutAsync(request, ct);
                return Results.NoContent();
            })
            .AllowAnonymous()
            .WithName("Logout")
            .Produces(StatusCodes.Status204NoContent);

        group.MapPost("/confirm-email", async (ConfirmEmailRequest request, AuthService auth, CancellationToken ct) =>
            {
                var error = await auth.ConfirmEmailAsync(request, ct);
                return error?.ToResult() ?? Results.NoContent();
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("ConfirmEmail")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        // Recuperação de senha (T-22): 202 exista ou não a conta.
        group.MapPost("/forgot-password", async (ForgotPasswordRequest request, AuthService auth, CancellationToken ct) =>
            {
                await auth.ForgotPasswordAsync(request, ct);
                return Results.Accepted();
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("ForgotPassword")
            .Produces(StatusCodes.Status202Accepted)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapPost("/reset-password", async (ResetPasswordRequest request, AuthService auth, CancellationToken ct) =>
            {
                var error = await auth.ResetPasswordAsync(request, ct);
                return error?.ToResult() ?? Results.NoContent();
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("ResetPassword")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        // Reenvio da confirmação (T-22): 202 exista ou não a conta, confirmada ou não.
        group.MapPost("/resend-confirmation", async (ResendConfirmationRequest request, AuthService auth, CancellationToken ct) =>
            {
                await auth.ResendConfirmationAsync(request, ct);
                return Results.Accepted();
            })
            .AllowAnonymous()
            .RequireRateLimiting(AuthRateLimitSettings.PolicyName)
            .WithName("ResendConfirmation")
            .Produces(StatusCodes.Status202Accepted)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapGet("/me", async (ITenantContext tenant, AuthService auth) =>
                tenant.UserId is { } userId && await auth.GetMeAsync(userId, tenant.PetshopId) is { } me
                    ? Results.Ok(me)
                    : Results.Unauthorized())
            .WithName("GetMe")
            .Produces<MeResponse>()
            .Produces(StatusCodes.Status401Unauthorized);

        return app;
    }

    private static SessionResponse ToResponse(Session session) => new(
        session.AccessToken,
        "Bearer",
        (int)JwtSettings.AccessTokenLifetime.TotalSeconds,
        session.RefreshToken,
        session.RefreshTokenExpiresAt);
}
