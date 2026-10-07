using Npgsql;
using PetGest.Api.Data;

namespace PetGest.Api.Tests;

// Padrões de conexão para o pooler do Supabase (design D3 da T-17).
public class DatabaseSetupTests
{
    private const string Base = "Host=db.exemplo;Port=5432;Database=postgres;Username=petgest_api;Password=x";

    [Fact]
    public void String_sem_os_ajustes_recebe_os_padroes()
    {
        var result = new NpgsqlConnectionStringBuilder(DatabaseSetup.WithDefaults(Base));

        Assert.Equal(DatabaseSetup.KeepaliveSeconds, result.KeepAlive);
        Assert.Equal(DatabaseSetup.ConnectionIdleLifetimeSeconds, result.ConnectionIdleLifetime);
        Assert.Equal(DatabaseSetup.MaxPoolSize, result.MaxPoolSize);
        Assert.Equal("db.exemplo", result.Host);
        Assert.Equal("petgest_api", result.Username);
    }

    [Theory]
    [InlineData("Keepalive=5;Connection Idle Lifetime=20;Maximum Pool Size=3")]
    [InlineData("keepalive=5;ConnectionIdleLifetime=20;MaxPoolSize=3")]
    public void Valores_explicitos_prevalecem(string overrides)
    {
        var result = new NpgsqlConnectionStringBuilder(DatabaseSetup.WithDefaults($"{Base};{overrides}"));

        Assert.Equal(5, result.KeepAlive);
        Assert.Equal(20, result.ConnectionIdleLifetime);
        Assert.Equal(3, result.MaxPoolSize);
    }
}
