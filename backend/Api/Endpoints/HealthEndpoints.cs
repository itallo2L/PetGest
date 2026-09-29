using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace PetGest.Api.Endpoints;

public static class HealthEndpoints
{
    // Endpoint minimal (e não MapHealthChecks) para aparecer no documento OpenAPI.
    // O corpo é só o status: detalhes da conexão/exceção ficam no log, nunca na resposta.
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", async (HealthCheckService health, CancellationToken ct) =>
            {
                var report = await health.CheckHealthAsync(ct);
                var healthy = report.Status == HealthStatus.Healthy;
                return Results.Text(
                    report.Status.ToString(),
                    "text/plain",
                    statusCode: healthy ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable);
            })
            .AllowAnonymous()
            .WithName("GetHealth")
            .WithTags("Health")
            .Produces<string>(StatusCodes.Status200OK, "text/plain")
            .Produces<string>(StatusCodes.Status503ServiceUnavailable, "text/plain");

        return app;
    }
}
