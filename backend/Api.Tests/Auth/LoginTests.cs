using System.Net;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Requisitos "Login com e-mail e senha" e "Exigência de e-mail confirmado configurável"
// da spec api-auth.
[Collection(DatabaseCollection.Name)]
public class LoginTests(DatabaseFixture fixture) : IDisposable
{
    private static readonly Dictionary<string, string?> RequireConfirmed = new() { ["Auth:RequireConfirmedEmail"] = "true" };

    private readonly AuthApi _api = new(fixture);

    public void Dispose() => _api.Dispose();

    [Fact]
    public async Task Credenciais_corretas_abrem_sessao()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        var session = await AuthApi.ReadSessionAsync(await _api.LoginAsync(email));

        Assert.False(string.IsNullOrEmpty(session.AccessToken));
        Assert.False(string.IsNullOrEmpty(session.RefreshToken));
        Assert.Equal("Bearer", session.TokenType);
        Assert.Equal(900, session.ExpiresIn);
    }

    [Fact]
    public async Task Email_com_espacos_e_outra_caixa_entra()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync("  " + email.ToUpperInvariant() + " ")).StatusCode);
    }

    [Fact]
    public async Task Senha_errada_e_email_desconhecido_tem_a_mesma_resposta()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        var wrongPassword = await _api.LoginAsync(email, "errada");
        var unknownEmail = await _api.LoginAsync(AuthApi.NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal("invalid_credentials", await AuthApi.ReadCodeAsync(wrongPassword));
        // Mesmo corpo, a não ser o traceId (um por requisição).
        Assert.Equal(await WithoutTraceIdAsync(wrongPassword), await WithoutTraceIdAsync(unknownEmail));
    }

    private static async Task<string> WithoutTraceIdAsync(HttpResponseMessage response)
    {
        var body = System.Text.Json.Nodes.JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        body.Remove("traceId");
        return body.ToJsonString();
    }

    [Fact]
    public async Task Exigencia_desligada_aceita_email_nao_confirmado()
    {
        var email = AuthApi.NewEmail();
        await _api.SignupAsync(email);

        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(email)).StatusCode);
    }

    [Fact]
    public async Task Exigencia_ligada_recusa_email_nao_confirmado()
    {
        using var api = new AuthApi(fixture, RequireConfirmed);
        var email = AuthApi.NewEmail();
        await api.SignupAsync(email);

        var response = await api.LoginAsync(email);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("email_not_confirmed", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Exigencia_ligada_com_senha_errada_nao_revela_a_confirmacao()
    {
        using var api = new AuthApi(fixture, RequireConfirmed);
        var email = AuthApi.NewEmail();
        await api.SignupAsync(email);

        var response = await api.LoginAsync(email, "errada");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_credentials", await AuthApi.ReadCodeAsync(response));
    }
}
