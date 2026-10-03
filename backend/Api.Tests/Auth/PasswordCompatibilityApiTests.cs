using System.Net;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Services;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Senhas das contas importadas do V0" da spec api-auth, pela API: o hash
// bcrypt (como o de auth.users) entra e é regravado no primeiro login.
[Collection(DatabaseCollection.Name)]
public class PasswordCompatibilityApiTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    private async Task<(Guid Id, string Email)> ImportedUserAsync()
    {
        await using var db = fixture.Anonymous();
        var id = await DatabaseFixture.AddUserAsync(db, BCrypt.Net.BCrypt.HashPassword("senha-do-v0", workFactor: 10));
        return (id, (await db.Users.SingleAsync(u => u.Id == id)).Email!);
    }

    private async Task<string?> HashOf(Guid id)
    {
        await using var db = fixture.Anonymous();
        return (await db.Users.AsNoTracking().SingleAsync(u => u.Id == id)).PasswordHash;
    }

    [Fact]
    public async Task Primeiro_login_aceita_o_bcrypt_e_regrava_o_hash()
    {
        var (id, email) = await ImportedUserAsync();

        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(email, "senha-do-v0")).StatusCode);

        var hash = await HashOf(id);
        Assert.False(CompatPasswordHasher.IsBcrypt(hash));
        // Depois da regravação a mesma senha continua entrando.
        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(email, "senha-do-v0")).StatusCode);
    }

    [Fact]
    public async Task Senha_errada_em_conta_importada_e_recusada_e_mantem_o_hash()
    {
        var (id, email) = await ImportedUserAsync();
        var before = await HashOf(id);

        var response = await _api.LoginAsync(email, "errada");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_credentials", await AuthApi.ReadCodeAsync(response));
        Assert.Equal(before, await HashOf(id));
    }
}
