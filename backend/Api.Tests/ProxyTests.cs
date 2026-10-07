using System.Net;
using System.Net.Http.Json;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests;

// IP do cliente atrás do proxy do App Service (design D2 da T-17): o limite de
// tentativas de /auth conta por cliente, não pelo IP do proxy.
[Collection(DatabaseCollection.Name)]
public class ProxyTests(DatabaseFixture fixture)
{
    private ApiFactory Factory(bool forwarded) => new(
        connectionString: fixture.ConnectionString,
        settings: new Dictionary<string, string?>
        {
            ["RateLimit:Auth:PermitLimit"] = "1",
            ["ForwardedHeaders:Enabled"] = forwarded ? "true" : "false",
        });

    private static Task<HttpResponseMessage> LoginFrom(HttpClient client, string forwardedFor)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new { email = $"{Guid.NewGuid():N}@teste.invalid", password = "errada" }),
        };
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request);
    }

    [Fact]
    public async Task Com_o_proxy_ligado_cada_cliente_tem_o_proprio_limite()
    {
        using var factory = Factory(forwarded: true);
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginFrom(client, "203.0.113.10")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginFrom(client, "203.0.113.20")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginFrom(client, "203.0.113.10")).StatusCode);
    }

    [Fact]
    public async Task So_a_ultima_entrada_do_cabecalho_conta()
    {
        using var factory = Factory(forwarded: true);
        using var client = factory.CreateClient();

        // O cliente forja uma entrada; o proxy acrescenta o IP real no fim.
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginFrom(client, "198.51.100.1, 203.0.113.30")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginFrom(client, "198.51.100.2, 203.0.113.30")).StatusCode);
    }

    [Fact]
    public async Task Com_o_proxy_desligado_o_cabecalho_e_ignorado()
    {
        using var factory = Factory(forwarded: false);
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginFrom(client, "203.0.113.40")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginFrom(client, "203.0.113.50")).StatusCode);
    }
}
