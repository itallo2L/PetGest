using System.Net;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Recuperação de senha" da spec api-auth (T-22).
[Collection(DatabaseCollection.Name)]
public class PasswordResetTests(DatabaseFixture fixture) : IDisposable
{
    private const string NewPassword = "senha-nova-456";

    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    private Task<HttpResponseMessage> ForgotAsync(string email) =>
        _api.PostAsync("/auth/forgot-password", new { email });

    private Task<HttpResponseMessage> ResetAsync(Guid userId, string code, string password = NewPassword) =>
        _api.PostAsync("/auth/reset-password", new { userId, code, password });

    [Fact]
    public async Task Pedido_para_conta_existente_envia_o_link()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        var response = await ForgotAsync(email);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var message = _api.Emails.Sent.Last(m => m.To == email);
        Assert.Equal("Redefinir sua senha do PetGest", message.Subject);
        Assert.Contains("http://localhost:5183/redefinir-senha?user=", message.Body);
        Assert.Contains("/redefinir-senha?user=", message.Html);
        _api.ResetFor(email);
    }

    [Fact]
    public async Task Pedido_para_email_sem_conta_responde_igual_e_nao_envia()
    {
        var email = AuthApi.NewEmail();

        var response = await ForgotAsync(email);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.DoesNotContain(_api.Emails.Sent, m => m.To == email);
    }

    [Fact]
    public async Task Falha_no_envio_nao_muda_a_resposta()
    {
        var email = AuthApi.NewEmail();
        using (var setup = new AuthApi(fixture))
        {
            await setup.SignupAsync(email);
        }
        using var failing = new AuthApi(fixture, emailSender: new FailingEmailSender());

        var response = await failing.PostAsync("/auth/forgot-password", new { email });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    [Fact]
    public async Task Senha_nova_vale_a_antiga_nao_e_as_sessoes_caem()
    {
        var email = AuthApi.NewEmail();
        var session = await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);

        var response = await ResetAsync(userId, code);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.LoginAsync(email)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(email, NewPassword)).StatusCode);
        var refresh = await _api.RefreshAsync(session.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Redefinir_confirma_o_email()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);

        await ResetAsync(userId, code);

        await using var db = fixture.Anonymous();
        Assert.True((await db.Users.SingleAsync(u => u.Id == userId)).EmailConfirmed);
    }

    [Fact]
    public async Task Link_usado_nao_vale_de_novo()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);
        await ResetAsync(userId, code);

        var again = await ResetAsync(userId, code, "outra-senha-789");

        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Equal("invalid_reset", await AuthApi.ReadCodeAsync(again));
    }

    [Fact]
    public async Task Link_vale_por_uma_hora()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);

        _api.Time.Advance(TimeSpan.FromMinutes(61));
        var response = await ResetAsync(userId, code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_reset", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Link_ainda_vale_aos_59_minutos()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);

        _api.Time.Advance(TimeSpan.FromMinutes(59));

        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(userId, code)).StatusCode);
    }

    [Fact]
    public async Task Codigo_alterado_ou_de_outra_conta_e_recusado()
    {
        var emailA = AuthApi.NewEmail();
        var emailB = AuthApi.NewEmail();
        await _api.SignupAsync(emailA);
        await _api.SignupAsync(emailB);
        await ForgotAsync(emailA);
        await ForgotAsync(emailB);
        var (userA, codeA) = _api.ResetFor(emailA);
        var (_, codeB) = _api.ResetFor(emailB);
        var tampered = (codeA[0] == 'A' ? "B" : "A") + codeA[1..];

        foreach (var bad in new[] { codeB, tampered, "nao-e-base64url!!" })
        {
            var response = await ResetAsync(userA, bad);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("invalid_reset", await AuthApi.ReadCodeAsync(response));
        }
        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(emailA)).StatusCode);
    }

    [Fact]
    public async Task Senha_fraca_e_recusada_e_o_link_continua_valendo()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (userId, code) = _api.ResetFor(email);

        var weak = await ResetAsync(userId, code, "123");

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal("weak_password", await AuthApi.ReadCodeAsync(weak));
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(userId, code)).StatusCode);
    }

    [Fact]
    public async Task Usuario_inexistente_e_recusado()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        await ForgotAsync(email);
        var (_, code) = _api.ResetFor(email);

        var response = await ResetAsync(Guid.NewGuid(), code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_reset", await AuthApi.ReadCodeAsync(response));
    }
}
