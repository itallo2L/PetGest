using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Models;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Cadastro atômico de conta e petshop" da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class SignupTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    [Fact]
    public async Task Cadastro_cria_conta_petshop_e_vinculo_e_devolve_sessao()
    {
        var email = AuthApi.NewEmail();
        var response = await _api.PostAsync("/auth/signup", new
        {
            email = "  " + email + " ",
            password = AuthApi.Password,
            petshopName = "  Pet do Teste  ",
            petshopEmail = " loja@teste.invalid ",
            petshopPhone = "   ",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<SessionResponse>())!;
        var token = AuthApi.Decode(session.AccessToken);

        await using var db = fixture.Anonymous();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        var profile = await db.Profiles.IgnoreQueryFilters().SingleAsync(p => p.Id == user.Id);
        var petshop = await db.Petshops.IgnoreQueryFilters().SingleAsync(p => p.Id == profile.PetshopId);

        Assert.Equal(user.Id.ToString(), token.Subject);
        Assert.Equal(petshop.Id.ToString(), token.GetClaim("petshop_id").Value);
        Assert.Equal("Pet do Teste", petshop.Name);
        Assert.Equal("loja@teste.invalid", petshop.Email);
        Assert.Null(petshop.Phone);
        Assert.False(user.EmailConfirmed);
    }

    [Fact]
    public async Task Telefone_da_loja_e_gravado_sem_espacos()
    {
        var email = AuthApi.NewEmail();
        await _api.PostAsync("/auth/signup", new
        {
            email, password = AuthApi.Password, petshopName = "Pet", petshopEmail = "l@t.invalid", petshopPhone = " 11 99999-0000 ",
        });

        await using var db = fixture.Anonymous();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        var profile = await db.Profiles.IgnoreQueryFilters().SingleAsync(p => p.Id == user.Id);
        Assert.Equal("11 99999-0000", (await db.Petshops.IgnoreQueryFilters().SingleAsync(p => p.Id == profile.PetshopId)).Phone);
    }

    [Fact]
    public async Task Email_repetido_com_outra_caixa_da_409_e_nao_grava_nada()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var petshopName = "Pet Duplicado " + Guid.NewGuid();

        var response = await _api.PostAsync("/auth/signup", new
        {
            email = email.ToUpperInvariant(), password = AuthApi.Password, petshopName, petshopEmail = "l@t.invalid",
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("email_taken", await AuthApi.ReadCodeAsync(response));
        await using var db = fixture.Anonymous();
        Assert.Equal(1, await db.Users.CountAsync(u => u.NormalizedEmail == email.ToUpperInvariant()));
        Assert.False(await db.Petshops.IgnoreQueryFilters().AnyAsync(p => p.Name == petshopName));
    }

    [Fact]
    public async Task Senha_curta_da_400_weak_password_e_nao_grava_nada()
    {
        var email = AuthApi.NewEmail();
        var response = await _api.PostAsync("/auth/signup", new
        {
            email, password = "12345", petshopName = "Pet", petshopEmail = "l@t.invalid",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("weak_password", await AuthApi.ReadCodeAsync(response));
        await using var db = fixture.Anonymous();
        Assert.False(await db.Users.AnyAsync(u => u.Email == email));
    }

    [Theory]
    [InlineData("nao-e-email", "Pet", "l@t.invalid")]
    [InlineData(null, "   ", "l@t.invalid")]
    [InlineData(null, "Pet", "")]
    [InlineData(null, "Pet", "nao-e-email")]
    public async Task Dados_invalidos_dao_400_e_nao_gravam_nada(string? email, string petshopName, string petshopEmail)
    {
        email ??= AuthApi.NewEmail();
        var response = await _api.PostAsync("/auth/signup", new
        {
            email, password = AuthApi.Password, petshopName, petshopEmail,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var db = fixture.Anonymous();
        Assert.False(await db.Users.AnyAsync(u => u.Email == email));
    }

    [Fact]
    public async Task Cadastro_envia_o_link_de_confirmacao()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        var message = Assert.Single(_api.Emails.Sent, m => m.To == email);
        Assert.Contains("http://localhost:5183/confirmar-email?user=", message.Body);
        var (userId, code) = _api.ConfirmationFor(email);
        await using var db = fixture.Anonymous();
        Assert.Equal((await db.Users.SingleAsync(u => u.Email == email)).Id, userId);
        Assert.NotEmpty(code);
    }

    [Fact]
    public async Task Falha_no_envio_do_email_nao_desfaz_o_cadastro()
    {
        using var api = new AuthApi(fixture, emailSender: new FailingEmailSender());
        var email = AuthApi.NewEmail();

        await api.SignupAsync(email);

        await using var db = fixture.Anonymous();
        Assert.True(await db.Users.AnyAsync(u => u.Email == email));
    }
}
