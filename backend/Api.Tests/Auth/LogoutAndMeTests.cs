using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisitos "Logout", "Dados da sessão atual" e o conteúdo do token de "Sessão com
// token de acesso e refresh token" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class LogoutAndMeTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    [Fact]
    public async Task Logout_invalida_o_refresh_token()
    {
        var session = await _api.SignupAsync();

        var logout = await _api.PostAsync("/auth/logout", new { refreshToken = session.RefreshToken });

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.RefreshAsync(session.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Logout_com_token_desconhecido_ou_revogado_responde_204()
    {
        var session = await _api.SignupAsync();
        await _api.PostAsync("/auth/logout", new { refreshToken = session.RefreshToken });

        Assert.Equal(HttpStatusCode.NoContent,
            (await _api.PostAsync("/auth/logout", new { refreshToken = session.RefreshToken })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await _api.PostAsync("/auth/logout", new { refreshToken = "desconhecido" })).StatusCode);
    }

    [Fact]
    public async Task Token_de_acesso_traz_usuario_email_petshop_e_15_minutos()
    {
        var email = AuthApi.NewEmail();
        var session = await _api.SignupAsync(email);
        var token = AuthApi.Decode(session.AccessToken);

        await using var db = fixture.Anonymous();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        var profile = await db.Profiles.IgnoreQueryFilters().SingleAsync(p => p.Id == user.Id);
        Assert.Equal(user.Id.ToString(), token.Subject);
        Assert.Equal(email, token.GetClaim("email").Value);
        Assert.Equal(profile.PetshopId.ToString(), token.GetClaim("petshop_id").Value);
        Assert.Equal(TimeSpan.FromMinutes(15), token.ValidTo - token.IssuedAt);
    }

    [Fact]
    public async Task Me_devolve_os_dados_da_sessao()
    {
        var email = AuthApi.NewEmail();
        var session = await _api.SignupAsync(email);

        var response = await _api.MeAsync(session.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = (await response.Content.ReadFromJsonAsync<MeResponse>())!;
        Assert.Equal(email, me.Email);
        Assert.False(me.EmailConfirmed);
        Assert.Equal(AuthApi.Decode(session.AccessToken).GetClaim("petshop_id").Value, me.PetshopId.ToString());
    }

    [Fact]
    public async Task Me_sem_token_responde_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.MeAsync(null)).StatusCode);
    }

    [Fact]
    public async Task Dois_cadastros_veem_cada_um_o_proprio_petshop()
    {
        var a = await _api.SignupAsync(petshopName: "Pet A");
        var b = await _api.SignupAsync(petshopName: "Pet B");

        var meA = (await (await _api.MeAsync(a.AccessToken)).Content.ReadFromJsonAsync<MeResponse>())!;
        var meB = (await (await _api.MeAsync(b.AccessToken)).Content.ReadFromJsonAsync<MeResponse>())!;

        Assert.NotEqual(meA.PetshopId, meB.PetshopId);
        await using var db = fixture.Anonymous();
        Assert.Equal("Pet A", (await db.Petshops.IgnoreQueryFilters().SingleAsync(p => p.Id == meA.PetshopId)).Name);
        Assert.Equal("Pet B", (await db.Petshops.IgnoreQueryFilters().SingleAsync(p => p.Id == meB.PetshopId)).Name);
    }

    [Fact]
    public async Task Conta_sem_vinculo_tem_token_e_me_sem_petshop()
    {
        string email;
        await using (var db = fixture.Anonymous())
        {
            var userId = await DatabaseFixture.AddUserAsync(db, new CompatPasswordHasher().HashPassword(new AppUser(), AuthApi.Password));
            email = (await db.Users.SingleAsync(u => u.Id == userId)).Email!;
        }

        var session = await AuthApi.ReadSessionAsync(await _api.LoginAsync(email));
        var me = (await (await _api.MeAsync(session.AccessToken)).Content.ReadFromJsonAsync<MeResponse>())!;

        Assert.False(AuthApi.Decode(session.AccessToken).TryGetClaim("petshop_id", out _));
        Assert.Null(me.PetshopId);
    }
}
