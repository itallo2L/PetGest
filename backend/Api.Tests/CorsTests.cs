using System.Net;

namespace PetGest.Api.Tests;

public class CorsTests : IDisposable
{
    // Formato real das prévias da Vercel: pet-gest-<hash>-<escopo> e pet-gest-git-<branch>-<escopo>.
    private const string PreviewOrigin = "https://pet-gest-git-dev-" + VercelScope + ".vercel.app";
    private const string OtherProjectPreview = "https://outro-projeto-git-dev-" + VercelScope + ".vercel.app";
    private const string OtherScopePreview = "https://pet-gest-git-dev-outro-time.vercel.app";

    // Precisa bater com o <escopo> de Cors:AllowedOriginPatterns no appsettings.json.
    private const string VercelScope = "itallo2ls-projects";

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public CorsTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Theory]
    [InlineData("https://pet-gest.vercel.app")]
    [InlineData("http://localhost:5183")]
    [InlineData(PreviewOrigin)]
    [InlineData("https://pet-gest-7mz3xwlih-" + VercelScope + ".vercel.app")]
    [InlineData("https://pet-gest-8fd8-97kh7io9p-" + VercelScope + ".vercel.app")]
    public async Task Origem_do_frontend_recebe_Allow_Origin(string origin)
    {
        var response = await SendAsync(HttpMethod.Get, origin);

        Assert.Equal(origin, AllowOrigin(response));
    }

    [Fact]
    public async Task Preflight_do_localhost_e_aceito()
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/health");
        request.Headers.Add("Origin", "http://localhost:5183");
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:5183", AllowOrigin(response));
    }

    [Theory]
    [InlineData("https://exemplo.com")]
    [InlineData(OtherProjectPreview)]
    [InlineData(OtherScopePreview)]
    [InlineData("https://pet-gest.vercel.app.exemplo.com")]
    public async Task Origem_desconhecida_nao_recebe_Allow_Origin(string origin)
    {
        var response = await SendAsync(HttpMethod.Get, origin);

        Assert.Null(AllowOrigin(response));
    }

    [Fact]
    public async Task Nao_permite_credenciais_entre_origens()
    {
        var response = await SendAsync(HttpMethod.Get, "https://pet-gest.vercel.app");

        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    private Task<HttpResponseMessage> SendAsync(HttpMethod method, string origin)
    {
        var request = new HttpRequestMessage(method, "/health");
        request.Headers.Add("Origin", origin);
        return _client.SendAsync(request);
    }

    private static string? AllowOrigin(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.Single() : null;
}
