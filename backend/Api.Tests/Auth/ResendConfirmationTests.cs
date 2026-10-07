using System.Net;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisito "Reenvio da confirmação de e-mail" da spec api-auth (T-22).
[Collection(DatabaseCollection.Name)]
public class ResendConfirmationTests(DatabaseFixture fixture) : IDisposable
{
    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    private Task<HttpResponseMessage> ResendAsync(string email) =>
        _api.PostAsync("/auth/resend-confirmation", new { email });

    [Fact]
    public async Task Conta_nao_confirmada_recebe_link_novo_que_funciona()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);
        var before = _api.Emails.Sent.Count(m => m.To == email);

        var response = await ResendAsync(email);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(before + 1, _api.Emails.Sent.Count(m => m.To == email));
        var (userId, code) = _api.ConfirmationFor(email);
        var confirm = await _api.PostAsync("/auth/confirm-email", new { userId, code });
        Assert.Equal(HttpStatusCode.NoContent, confirm.StatusCode);
    }

    [Fact]
    public async Task Conta_ja_confirmada_ou_inexistente_nao_recebe_nada()
    {
        var confirmed = AuthApi.NewEmail();
        await _api.SignupAsync(confirmed);
        var (userId, code) = _api.ConfirmationFor(confirmed);
        await _api.PostAsync("/auth/confirm-email", new { userId, code });
        var missing = AuthApi.NewEmail();
        var sentBefore = _api.Emails.Sent.Count;

        Assert.Equal(HttpStatusCode.Accepted, (await ResendAsync(confirmed)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await ResendAsync(missing)).StatusCode);
        Assert.Equal(sentBefore, _api.Emails.Sent.Count);
    }

    [Fact]
    public async Task Email_de_confirmacao_tem_texto_e_html()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        var message = _api.Emails.Sent.Last(m => m.To == email);

        Assert.Equal("Confirme seu e-mail no PetGest", message.Subject);
        Assert.Contains("24 horas", message.Body);
        Assert.NotNull(message.Html);
        Assert.Contains("/confirmar-email?user=", message.Html);
    }
}
