using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace PetGest.Api.Tests.Data;

// Ensaio da T-18 (design D7 da T-13), requisito "Schema versionado compatível com o
// banco do V0": o supabase/schema.sql do repositório e a migration V0Schema precisam
// descrever as mesmas tabelas, e ProductSourceAi precisa aplicar sobre o banco do V0.
public class SchemaCompatibilityTests : IAsyncLifetime
{
    private const string V0Database = "petgest_v0";
    private const string EfDatabase = "petgest_v0_ef";
    private const string V0SchemaMigration = "V0Schema";

    private static readonly string[] Tables = ["petshops", "profiles", "products"];

    // Diferenças esperadas entre o V0 e a migration (prefixos de linha de DescribeAsync):
    // objetos que dependem do Supabase.
    private static readonly string[] IgnoredInV0 =
    [
        "column products.petshop_id default", // current_petshop_id(), que lê auth.uid()
        "constraint profiles.profiles_id_fkey", // FK para auth.users (a do Identity é da T-14)
    ];

    private static string V0ConnectionString => DatabaseFixture.ConnectionStringFor(V0Database);
    private static string EfConnectionString => DatabaseFixture.ConnectionStringFor(EfDatabase);

    public async Task InitializeAsync()
    {
        await RecreateDatabaseAsync(V0Database);
        await RecreateDatabaseAsync(EfDatabase);

        await using var v0 = new NpgsqlConnection(V0ConnectionString);
        await v0.OpenAsync();
        await ExecuteAsync(v0, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Sql", "supabase-stub.sql")));
        await ExecuteAsync(v0, await File.ReadAllTextAsync(Path.Combine(RepositoryRoot(), "supabase", "schema.sql")));
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Migration_V0Schema_descreve_as_mesmas_tabelas_do_schema_sql()
    {
        await using (var ef = DatabaseFixture.Open(EfConnectionString, new FixedTenant(null, null)))
        {
            await ef.GetService<IMigrator>().MigrateAsync(V0SchemaMigration);
        }

        var v0 = (await DescribeAsync(V0ConnectionString))
            .Where(line => !IgnoredInV0.Any(line.StartsWith))
            .ToHashSet();
        var ef0 = (await DescribeAsync(EfConnectionString)).ToHashSet();

        var onlyInV0 = v0.Except(ef0).Order().ToList();
        var onlyInEf = ef0.Except(v0).Order().ToList();
        Assert.True(onlyInV0.Count == 0 && onlyInEf.Count == 0,
            "Schema do V0 e migration V0Schema divergem.\n" +
            $"Só no schema.sql:\n  {string.Join("\n  ", onlyInV0)}\n" +
            $"Só na migration:\n  {string.Join("\n  ", onlyInEf)}");
    }

    [Fact]
    public async Task Banco_do_V0_recebe_as_migrations_seguintes_sem_perder_dados()
    {
        await using var db = DatabaseFixture.Open(V0ConnectionString, new FixedTenant(null, null));

        // Linha gravada pelo V0 antes da virada.
        var petshopId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        await db.Database.ExecuteSqlAsync($"insert into petshops (id, name, email) values ({petshopId}, 'Pet A', 'a@loja.invalid')");
        await db.Database.ExecuteSqlAsync(
            $"insert into products (id, petshop_id, name, category, price, ean, source) values ({productId}, {petshopId}, 'Ração X 1kg', 'Ração', 39.90, '7891000100103', 'barcode')");

        // Baseline: o que a T-18 fará em produção — registrar V0Schema como aplicada.
        var history = db.GetService<IHistoryRepository>();
        var migrations = db.GetService<IMigrationsAssembly>();
        var v0SchemaId = migrations.Migrations.Keys.Single(id => id.EndsWith("_" + V0SchemaMigration));
        var productVersion = typeof(DbContext).Assembly
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .Cast<System.Reflection.AssemblyInformationalVersionAttribute>().Single().InformationalVersion.Split('+')[0];
        await db.Database.ExecuteSqlRawAsync(history.GetCreateIfNotExistsScript());
        await db.Database.ExecuteSqlRawAsync(history.GetInsertScript(new HistoryRow(v0SchemaId, productVersion)));

        await db.Database.MigrateAsync();

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        var source = await db.Database
            .SqlQuery<string>($"select source as \"Value\" from products where id = {productId}")
            .SingleAsync();
        Assert.Equal("barcode", source);
        // A coluna e as origens novas existem depois da migration.
        await db.Database.ExecuteSqlAsync(
            $"insert into products (petshop_id, name, category, price, source, ai_raw_response) values ({petshopId}, 'Ração Y', 'Ração', 10, 'photo_ai', '{{\"name\":\"Ração Y\"}}'::jsonb)");
    }

    // ---- Descrição das tabelas pelo catálogo ---------------------------------------

    private static async Task<List<string>> DescribeAsync(string connectionString)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        var lines = new List<string>();

        // Um fato por linha; o default da coluna fica numa linha à parte para a exceção
        // de products.petshop_id poder ser ignorada sozinha.
        await foreach (var r in QueryAsync(conn, """
            select table_name, column_name, data_type, is_nullable,
                   coalesce(numeric_precision::text, ''), coalesce(numeric_scale::text, ''),
                   coalesce(column_default, '')
            from information_schema.columns
            where table_schema = 'public' and table_name = any(@tables)
            """))
        {
            lines.Add($"column {r[0]}.{r[1]} {r[2]} nullable={r[3]} precision={r[4]},{r[5]}");
            if (r[6] != "")
            {
                lines.Add($"column {r[0]}.{r[1]} default = {r[6]}");
            }
        }

        await foreach (var r in QueryAsync(conn, """
            select c.relname, k.conname, pg_get_constraintdef(k.oid)
            from pg_constraint k join pg_class c on c.oid = k.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = any(@tables)
            """))
        {
            lines.Add($"constraint {r[0]}.{r[1]} = {r[2]}");
        }

        await foreach (var r in QueryAsync(conn, """
            select tablename, indexname, indexdef from pg_indexes
            where schemaname = 'public' and tablename = any(@tables)
            """))
        {
            lines.Add($"index {r[0]}.{r[1]} = {r[2]}");
        }

        await foreach (var r in QueryAsync(conn, """
            select c.relname, t.tgname, pg_get_triggerdef(t.oid)
            from pg_trigger t join pg_class c on c.oid = t.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = any(@tables) and not t.tgisinternal
            """))
        {
            lines.Add($"trigger {r[0]}.{r[1]} = {r[2]}");
        }

        return lines;
    }

    private static async IAsyncEnumerable<string[]> QueryAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("tables", Tables);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new string[reader.FieldCount];
            for (var i = 0; i < row.Length; i++)
            {
                row[i] = reader.GetValue(i)?.ToString() ?? "";
            }
            yield return row;
        }
    }

    // ---- Infra -------------------------------------------------------------------

    private static async Task RecreateDatabaseAsync(string name)
    {
        await using var conn = new NpgsqlConnection(DatabaseFixture.ConnectionStringFor("postgres"));
        await conn.OpenAsync();
        await ExecuteAsync(conn, $"drop database if exists {name} with (force)");
        await ExecuteAsync(conn, $"create database {name}");

        // O "with (force)" derruba conexões que o pool ainda guardava do teste anterior.
        NpgsqlConnection.ClearAllPools();
    }

    private static async Task ExecuteAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static string RepositoryRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "supabase", "schema.sql")))
            {
                return dir.FullName;
            }
        }

        throw new InvalidOperationException("supabase/schema.sql não encontrado acima de " + AppContext.BaseDirectory);
    }
}
