using System.Net;
using System.Text.Json;

namespace PetGest.Api.Tests;

public class OpenApiTests
{
    [Fact]
    public async Task Documento_em_Development_inclui_GET_health()
    {
        using var factory = new ApiFactory();
        var response = await factory.CreateClient().GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.TryGetProperty("openapi", out _));
        Assert.True(doc.RootElement.GetProperty("paths").GetProperty("/health").TryGetProperty("get", out _));
    }

    [Fact]
    public async Task Interface_em_Development_carrega()
    {
        using var factory = new ApiFactory();
        var response = await factory.CreateClient().GetAsync("/swagger/index.html");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/openapi/v1.json")]
    [InlineData("/swagger/index.html")]
    public async Task Producao_nao_expoe_o_contrato(string path)
    {
        using var factory = new ApiFactory(environment: "Production");
        var response = await factory.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
