using System.Net;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Limite de tentativas" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class RateLimitTests(DatabaseFixture fixture)
{
    [Fact]
    public async Task Login_acima_do_limite_recebe_429()
    {
        using var api = new AuthApi(fixture, new Dictionary<string, string?>
        {
            ["RateLimit:Auth:PermitLimit"] = "3",
            ["RateLimit:Auth:WindowSeconds"] = "60",
        });

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
        {
            statuses.Add((await api.LoginAsync(AuthApi.NewEmail(), "errada")).StatusCode);
        }

        Assert.Equal(
            [HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized,
             HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests],
            statuses);
    }

    [Fact]
    public async Task Renovacao_nao_entra_no_limite()
    {
        using var api = new AuthApi(fixture, new Dictionary<string, string?> { ["RateLimit:Auth:PermitLimit"] = "1" });

        var session = await api.SignupAsync(); // consome a única permissão
        for (var i = 0; i < 3; i++)
        {
            session = await AuthApi.ReadSessionAsync(await api.RefreshAsync(session.RefreshToken));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await api.LoginAsync(AuthApi.NewEmail())).StatusCode);
    }

    [Fact]
    public async Task Pedido_de_redefinicao_acima_do_limite_recebe_429()
    {
        using var api = new AuthApi(fixture, new Dictionary<string, string?> { ["RateLimit:Auth:PermitLimit"] = "2" });

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            statuses.Add((await api.PostAsync("/auth/forgot-password", new { email = AuthApi.NewEmail() })).StatusCode);
        }

        Assert.Equal([HttpStatusCode.Accepted, HttpStatusCode.Accepted, HttpStatusCode.TooManyRequests], statuses);
    }
}
