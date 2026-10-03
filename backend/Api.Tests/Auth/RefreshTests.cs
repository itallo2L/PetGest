using System.Net;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Data.Entities;
using PetGest.Api.Services;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisitos "Sessão com token de acesso e refresh token" e "Renovação da sessão com
// rotação" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class RefreshTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    [Fact]
    public async Task Renovacao_devolve_sessao_nova_e_invalida_o_token_usado()
    {
        var first = await _api.SignupAsync();

        var second = await AuthApi.ReadSessionAsync(await _api.RefreshAsync(first.RefreshToken));

        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
        Assert.NotEqual(first.AccessToken, second.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.RefreshAsync(first.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Reuso_de_token_derruba_a_familia_inteira()
    {
        var first = await _api.SignupAsync();
        var second = await AuthApi.ReadSessionAsync(await _api.RefreshAsync(first.RefreshToken));

        var reuse = await _api.RefreshAsync(first.RefreshToken);

        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        Assert.Equal("invalid_refresh_token", await AuthApi.ReadCodeAsync(reuse));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.RefreshAsync(second.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Reuso_nao_afeta_outra_sessao_da_mesma_conta()
    {
        var email = AuthApi.NewEmail();
        var phone = await _api.SignupAsync(email);
        var laptop = await AuthApi.ReadSessionAsync(await _api.LoginAsync(email));

        await _api.RefreshAsync(phone.RefreshToken);
        await _api.RefreshAsync(phone.RefreshToken); // reuso: derruba só a família do celular

        Assert.Equal(HttpStatusCode.OK, (await _api.RefreshAsync(laptop.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Token_expirado_em_30_dias_e_recusado()
    {
        var session = await _api.SignupAsync();

        _api.Time.Advance(TimeSpan.FromDays(30) + TimeSpan.FromSeconds(1));
        var response = await _api.RefreshAsync(session.RefreshToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_refresh_token", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Token_dentro_da_validade_renova_e_ganha_prazo_novo()
    {
        var session = await _api.SignupAsync();

        _api.Time.Advance(TimeSpan.FromDays(29));
        var renewed = await AuthApi.ReadSessionAsync(await _api.RefreshAsync(session.RefreshToken));

        Assert.True(renewed.RefreshTokenExpiresAt > session.RefreshTokenExpiresAt + TimeSpan.FromDays(28));
    }

    [Fact]
    public async Task Token_desconhecido_e_recusado()
    {
        var response = await _api.RefreshAsync("token-que-nunca-existiu");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_refresh_token", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Refresh_token_nao_fica_em_texto_no_banco()
    {
        var session = await _api.SignupAsync();

        await using var db = fixture.Anonymous();
        Assert.False(await db.RefreshTokens.AnyAsync(t => t.TokenHash == session.RefreshToken));
        Assert.True(await db.RefreshTokens.AnyAsync(t => t.TokenHash == SessionService.HashRefreshToken(session.RefreshToken)));
    }

    [Fact]
    public async Task Renovacao_traz_o_petshop_do_vinculo_atual()
    {
        // Conta sem vínculo (como uma importada do V0 sem loja): token sem petshop.
        Guid userId;
        await using (var db = fixture.Anonymous())
        {
            userId = await DatabaseFixture.AddUserAsync(db, new CompatPasswordHasher().HashPassword(new AppUser(), AuthApi.Password));
        }
        var email = await EmailOf(userId);
        var before = await AuthApi.ReadSessionAsync(await _api.LoginAsync(email));
        Assert.False(AuthApi.Decode(before.AccessToken).TryGetClaim("petshop_id", out _));

        // A loja é vinculada depois; a renovação já traz o petshop.
        Guid petshopId;
        await using (var db = fixture.Anonymous())
        {
            var petshop = new Petshop { Name = "Pet Vinculado", Email = "v@t.invalid" };
            db.Petshops.Add(petshop);
            await db.SaveChangesAsync();
            db.Profiles.Add(new Profile { Id = userId, PetshopId = petshop.Id });
            await db.SaveChangesAsync();
            petshopId = petshop.Id;
        }
        var after = await AuthApi.ReadSessionAsync(await _api.RefreshAsync(before.RefreshToken));

        Assert.Equal(petshopId.ToString(), AuthApi.Decode(after.AccessToken).GetClaim("petshop_id").Value);
    }

    private async Task<string> EmailOf(Guid userId)
    {
        await using var db = fixture.Anonymous();
        return (await db.Users.SingleAsync(u => u.Id == userId)).Email!;
    }
}
