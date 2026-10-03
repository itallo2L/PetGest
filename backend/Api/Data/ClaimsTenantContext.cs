using System.Security.Claims;

namespace PetGest.Api.Data;

// Lê usuário e petshop só das claims do token da requisição, nunca do corpo/rota/query
// (design D4 da T-13). A T-14 emite `sub` e `petshop_id` no JWT; aceitar também
// NameIdentifier cobre o mapeamento de claims de entrada, se ele estiver ligado.
public class ClaimsTenantContext(IHttpContextAccessor httpContextAccessor) : ITenantContext
{
    public const string UserIdClaim = "sub";
    public const string PetshopIdClaim = "petshop_id";

    public Guid? UserId => ReadGuid(UserIdClaim) ?? ReadGuid(ClaimTypes.NameIdentifier);
    public Guid? PetshopId => ReadGuid(PetshopIdClaim);

    private Guid? ReadGuid(string claimType)
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        return Guid.TryParse(user.FindFirst(claimType)?.Value, out var value) && value != Guid.Empty
            ? value
            : null;
    }
}
