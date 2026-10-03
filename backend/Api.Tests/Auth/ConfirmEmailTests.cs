using System.Net;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Confirmação de e-mail" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class ConfirmEmailTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture, new Dictionary<string, string?> { ["Auth:RequireConfirmedEmail"] = "true" });

    public void Dispose() => _api.Dispose();

    private Task<HttpResponseMessage> ConfirmAsync(Guid userId, string code) =>
        _api.PostAsync("/auth/confirm-email", new { userId, code });

    [Fact]
    public async Task Codigo_valido_confirma_e_libera_o_login()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var (userId, code) = _api.ConfirmationFor(email);

        var response = await ConfirmAsync(userId, code);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var db = fixture.Anonymous();
        Assert.True((await db.Users.SingleAsync(u => u.Id == userId)).EmailConfirmed);
        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(email)).StatusCode);
    }

    [Fact]
    public async Task Confirmar_de_novo_e_inofensivo()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var (userId, code) = _api.ConfirmationFor(email);

        await ConfirmAsync(userId, code);

        Assert.Equal(HttpStatusCode.NoContent, (await ConfirmAsync(userId, code)).StatusCode);
    }

    [Fact]
    public async Task Codigo_alterado_e_recusado()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var (userId, code) = _api.ConfirmationFor(email);
        var tampered = (code[0] == 'A' ? "B" : "A") + code[1..];

        foreach (var bad in new[] { tampered, "nao-e-base64url!!", "x" })
        {
            var response = await ConfirmAsync(userId, bad);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("invalid_confirmation", await AuthApi.ReadCodeAsync(response));
        }

        await using var db = fixture.Anonymous();
        Assert.False((await db.Users.SingleAsync(u => u.Id == userId)).EmailConfirmed);
    }

    [Fact]
    public async Task Codigo_de_outra_conta_e_recusado()
    {
        var emailA = AuthApi.NewEmail();
        var emailB = AuthApi.NewEmail();
        await _api.SignupAsync(emailA);
        await _api.SignupAsync(emailB);
        var (userA, _) = _api.ConfirmationFor(emailA);
        var (_, codeB) = _api.ConfirmationFor(emailB);

        var response = await ConfirmAsync(userA, codeB);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_confirmation", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Usuario_inexistente_e_recusado()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var (_, code) = _api.ConfirmationFor(email);

        var response = await ConfirmAsync(Guid.NewGuid(), code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
