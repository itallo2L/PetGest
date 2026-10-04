using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Endpoints protegidos por padrão" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class ProtectedEndpointTests(DatabaseFixture fixture) : IDisposable
{
    // As únicas rotas públicas da API (spec api-auth). Rota nova sem token entra aqui de
    // propósito, nunca por esquecimento.
    private static readonly HashSet<string> PublicRoutes =
    [
        "GET /health",
        "GET /openapi/{documentName}.json",
        "POST /auth/signup",
        "POST /auth/login",
        "POST /auth/refresh",
        "POST /auth/logout",
        "POST /auth/confirm-email",
    ];

    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    private static string Token(
        string subject,
        DateTime issuedAt,
        DateTime expires,
        string key = ApiFactory.TestSigningKey,
        string issuer = "petgest-api",
        string audience = "petgest-app") =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Claims = new Dictionary<string, object> { ["sub"] = subject },
            IssuedAt = issuedAt,
            NotBefore = issuedAt,
            Expires = expires,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256),
        });

    private async Task<string> RealUserIdAsync() => AuthApi.Decode((await _api.SignupAsync()).AccessToken).Subject;

    [Fact]
    public async Task Token_valido_montado_no_teste_e_aceito()
    {
        // Controle: o mesmo formato dos casos abaixo, mas válido — garante que os 401 vêm
        // do defeito de cada token, não do formato.
        var now = DateTime.UtcNow;
        var token = Token(await RealUserIdAsync(), now, now.AddMinutes(15));

        Assert.Equal(HttpStatusCode.OK, (await _api.MeAsync(token)).StatusCode);
    }

    [Fact]
    public async Task Token_expirado_e_recusado()
    {
        var now = DateTime.UtcNow;
        var token = Token(await RealUserIdAsync(), now.AddMinutes(-16), now.AddMinutes(-1));

        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.MeAsync(token)).StatusCode);
    }

    [Fact]
    public async Task Token_assinado_com_outra_chave_e_recusado()
    {
        var now = DateTime.UtcNow;
        var token = Token(await RealUserIdAsync(), now, now.AddMinutes(15), key: "outra-chave-qualquer-com-mais-de-32-bytes-000000");

        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.MeAsync(token)).StatusCode);
    }

    [Theory]
    [InlineData("outro-emissor", "petgest-app")]
    [InlineData("petgest-api", "outra-audiencia")]
    public async Task Token_de_outro_emissor_ou_audiencia_e_recusado(string issuer, string audience)
    {
        var now = DateTime.UtcNow;
        var token = Token(await RealUserIdAsync(), now, now.AddMinutes(15), issuer: issuer, audience: audience);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.MeAsync(token)).StatusCode);
    }

    [Fact]
    public async Task Token_alterado_e_recusado()
    {
        var session = await _api.SignupAsync();
        var parts = session.AccessToken.Split('.');
        var otherUser = Base64UrlEncoder.Encode($$"""{"sub":"{{Guid.NewGuid()}}","iss":"petgest-api","aud":"petgest-app","exp":4102444800}""");

        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.MeAsync($"{parts[0]}.{otherUser}.{parts[2]}")).StatusCode);
    }

    [Fact]
    public async Task Health_e_publico()
    {
        var response = await _api.Client.GetAsync("/health");

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task So_as_rotas_publicas_da_spec_dispensam_token()
    {
        using var factory = new ApiFactory();
        var fallback = await factory.Services.GetRequiredService<IAuthorizationPolicyProvider>().GetFallbackPolicyAsync();
        Assert.NotNull(fallback);
        Assert.Contains(fallback.Requirements, r => r is DenyAnonymousAuthorizationRequirement);

        var routes = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["*"])
                .Select(method => (Route: $"{method} /{e.RoutePattern.RawText!.Trim('/')}", e.Metadata)))
            .ToList();

        var anonymous = routes.Where(r => r.Metadata.GetMetadata<IAllowAnonymous>() is not null).Select(r => r.Route).ToHashSet();
        Assert.Subset(PublicRoutes, anonymous);
        // Rotas protegidas conhecidas — existem e não estão entre as públicas.
        string[] protectedRoutes =
        [
            "GET /auth/me",
            "GET /products", "GET /products/{id:guid}", "GET /products/by-ean/{ean}",
            "POST /products", "PUT /products/{id:guid}", "DELETE /products/{id:guid}",
            "GET /petshop", "PUT /petshop", "POST /petshop",
        ];
        Assert.Subset(routes.Select(r => r.Route).ToHashSet(), protectedRoutes.ToHashSet());
        Assert.Empty(protectedRoutes.Intersect(anonymous));
    }
}
