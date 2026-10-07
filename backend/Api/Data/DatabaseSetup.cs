using Npgsql;

namespace PetGest.Api.Data;

// Padrões da conexão com o Postgres (design D3 da T-17). Em produção a API fala com o
// pooler do Supabase (Supavisor, modo session), que derruba conexões ociosas e tem um
// limite de conexões por projeto. O que a string de conexão já define explicitamente
// prevalece; só o que ela não diz recebe o padrão daqui.
public static class DatabaseSetup
{
    // Pacote TCP a cada 30 s numa conexão parada: mantém a conexão viva no caminho até
    // o pooler e faz a conexão derrubada ser descartada antes de ser usada.
    public const int KeepaliveSeconds = 30;

    // Conexão ociosa sai do pool depois de 60 s (o padrão do Npgsql é 300), antes de o
    // pooler ou um NAT intermediário a derrubar em silêncio — a causa do 500 na primeira
    // consulta depois de um tempo parado, visto no teste da T-16.
    public const int ConnectionIdleLifetimeSeconds = 60;

    // O projeto Supabase aceita 60 conexões no total; o padrão do Npgsql (100) poderia
    // esgotar sozinho o limite. Uma instância da API não precisa de mais que isto.
    public const int MaxPoolSize = 10;

    public static string WithDefaults(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (!HasKey(connectionString, "Keepalive"))
        {
            builder.KeepAlive = KeepaliveSeconds;
        }
        if (!HasKey(connectionString, "Connection Idle Lifetime", "ConnectionIdleLifetime"))
        {
            builder.ConnectionIdleLifetime = ConnectionIdleLifetimeSeconds;
        }
        if (!HasKey(connectionString, "Maximum Pool Size", "MaxPoolSize"))
        {
            builder.MaxPoolSize = MaxPoolSize;
        }
        return builder.ConnectionString;
    }

    // O builder sempre devolve um valor (o padrão), então "foi definido?" é respondido
    // pela string original, comparando as chaves sem espaços e sem caixa (sinônimos
    // como "MaxPoolSize" e "Maximum Pool Size" entram na lista de cada chamada).
    private static bool HasKey(string connectionString, params string[] keys)
    {
        static string Normalize(string key) => key.Replace(" ", "").ToUpperInvariant();
        var wanted = keys.Select(Normalize).ToHashSet();
        return connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(pair => Normalize(pair.Split('=', 2)[0].Trim()))
            .Any(wanted.Contains);
    }
}
