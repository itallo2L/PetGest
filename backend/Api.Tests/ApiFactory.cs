using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace PetGest.Api.Tests;

// Sobe a API em memória. Por padrão em Development, com o Postgres do docker-compose
// (localhost:5450) — no CI, o serviço postgres:17 do workflow usa a mesma porta.
public class ApiFactory(string environment = "Development", string? connectionString = null)
    : WebApplicationFactory<Program>
{
    public const string UnreachableDatabase =
        "Host=127.0.0.1;Port=1;Database=petgest;Username=petgest;Password=x;Timeout=2";

    private const string DevConnectionString =
        "Host=localhost;Port=5450;Database=petgest;Username=petgest;Password=petgest_dev";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = connectionString ?? DevConnectionString,
        }));
    }
}
