using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using PetGest.Api.Data;

namespace PetGest.Api.Tests;

// Requisito "Petshop da requisição vem só do token" da spec api-tenant-data.
public class TenantContextTests
{
    private static readonly Guid User = Guid.NewGuid();
    private static readonly Guid Petshop = Guid.NewGuid();

    private static ClaimsTenantContext ContextWith(params Claim[] claims)
    {
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Bearer")),
        };
        return new ClaimsTenantContext(new HttpContextAccessor { HttpContext = httpContext });
    }

    [Fact]
    public void Token_com_usuario_e_petshop()
    {
        var tenant = ContextWith(new Claim("sub", User.ToString()), new Claim("petshop_id", Petshop.ToString()));

        Assert.Equal(User, tenant.UserId);
        Assert.Equal(Petshop, tenant.PetshopId);
    }

    [Fact]
    public void Usuario_por_NameIdentifier_quando_as_claims_sao_mapeadas()
    {
        var tenant = ContextWith(new Claim(ClaimTypes.NameIdentifier, User.ToString()));

        Assert.Equal(User, tenant.UserId);
    }

    [Fact]
    public void Token_sem_petshop()
    {
        var tenant = ContextWith(new Claim("sub", User.ToString()));

        Assert.Equal(User, tenant.UserId);
        Assert.Null(tenant.PetshopId);
    }

    [Theory]
    [InlineData("nao-e-guid")]
    [InlineData("")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void Petshop_invalido_vira_sem_petshop(string value)
    {
        var tenant = ContextWith(new Claim("sub", User.ToString()), new Claim("petshop_id", value));

        Assert.Null(tenant.PetshopId);
    }

    [Fact]
    public void Usuario_nao_autenticado_e_anonimo_mesmo_com_claims()
    {
        // Identidade sem authenticationType = não autenticada.
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("sub", User.ToString()), new Claim("petshop_id", Petshop.ToString())])),
        };
        var tenant = new ClaimsTenantContext(new HttpContextAccessor { HttpContext = httpContext });

        Assert.Null(tenant.UserId);
        Assert.Null(tenant.PetshopId);
    }

    [Fact]
    public void Sem_HttpContext_e_anonimo()
    {
        var tenant = new ClaimsTenantContext(new HttpContextAccessor());

        Assert.Null(tenant.UserId);
        Assert.Null(tenant.PetshopId);
    }
}
