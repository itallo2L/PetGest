using PetGest.Api.Data;
using PetGest.Api.Models;
using PetGest.Api.Services;

namespace PetGest.Api.Endpoints;

// /auth (spec api-auth). Só /auth/me exige token; os demais abrem ou encerram sessão e
// são públicos — cadastro, login e confirmação com limite de tentativas (design D8).
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
