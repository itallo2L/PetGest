using System.Net;

namespace PetGest.Api.Tests;

public class HealthTests
{
    [Fact]
    public async Task Banco_no_ar_responde_200_Healthy()
    {
        using var factory = new ApiFactory();
        var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Banco_inalcancavel_responde_503_sem_detalhes()
    {
        using var factory = new ApiFactory(connectionString: ApiFactory.UnreachableDatabase);
        var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("Unhealthy", body);
        Assert.DoesNotContain("127.0.0.1", body);
        Assert.DoesNotContain("Exception", body);
    }

    [Fact]
    public async Task Chamada_sem_credenciais_nao_e_recusada_por_autenticacao()
    {
        using var factory = new ApiFactory();
        var response = await factory.CreateClient().GetAsync("/health");

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
