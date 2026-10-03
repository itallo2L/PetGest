using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace PetGest.Api.Tests;

// Sobe a API em memória. Por padrão em Development, com o Postgres do docker-compose
// (localhost:5450) — no CI, o serviço postgres:17 do workflow usa a mesma porta.
// A chave JWT e o limite alto de tentativas valem em todos os ambientes: sem chave a
// API não sobe, e as suítes fazem muitos logins pelo mesmo "IP" do TestServer.
public class ApiFactory(
    string environment = "Development",
    string? connectionString = null,
    IReadOnlyDictionary<string, string?>? settings = null,
    Action<IServiceCollection>? configureServices = null)
    : WebApplicationFactory<Program>
{
    public const string UnreachableDatabase =
        "Host=127.0.0.1;Port=1;Database=petgest;Username=petgest;Password=x;Timeout=2";

    public const string TestSigningKey = "test-only-signing-key-with-at-least-32-bytes-0123456789";

    private const string DevConnectionString =
        "Host=localhost;Port=5450;Database=petgest;Username=petgest;Password=petgest_dev";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = connectionString ?? DevConnectionString,
                ["Jwt:SigningKey"] = TestSigningKey,
                ["RateLimit:Auth:PermitLimit"] = "100000",
            });
            if (settings is not null)
            {
                config.AddInMemoryCollection(settings);
            }
        });
        if (configureServices is not null)
        {
            builder.ConfigureServices(configureServices);
        }
    }
}
