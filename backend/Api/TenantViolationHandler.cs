using Microsoft.AspNetCore.Diagnostics;
using PetGest.Api.Data;

namespace PetGest.Api;

// Rede de segurança do isolamento (design D6 da T-15): uma gravação recusada pelo
// TenantWriteGuard vira 403 em ProblemDetails, nunca 500. Os casos esperados (ex.:
// cadastro sem petshop) são conferidos antes nos serviços, com códigos próprios.
public class TenantViolationHandler(IProblemDetailsService problemDetails, ILogger<TenantViolationHandler> logger)
    : IExceptionHandler
{
    public const string Code = "tenant_violation";

    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not TenantViolationException)
        {
            return false;
        }

        logger.LogWarning(exception, "Gravação recusada pelo isolamento por petshop.");
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails =
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Operação não permitida para esta loja.",
                Extensions = { ["code"] = Code },
            },
        });
    }
}
