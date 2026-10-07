using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Tests.Auth;
using static PetGest.Api.Tests.Data.SchemaCompatibilityTests;

namespace PetGest.Api.Tests.Data;

// Ensaio da virada da T-18 (design D2 da T-18): roda os MESMOS arquivos de
// backend/deploy/t18/, na ordem do runbook, num banco montado como o de produção
// (supabase/schema.sql + contas no auth.users com hash bcrypt) e depois usa a API contra
// esse banco. Se uma migration nova entrar sem regerar o passo 5, este teste falha.
public partial class T18RehearsalTests : IAsyncLifetime
{
    private const string Database = "petgest_t18";
    private const string V0Password = "senha-do-v0";

    private static readonly Guid Owner = Guid.NewGuid();        // confirmado, loja A
    private static readonly Guid Unconfirmed = Guid.NewGuid();  // não confirmado, loja B
    private static readonly Guid Deleted = Guid.NewGuid();      // apagado no Supabase, sem loja
    private static readonly Guid StoreA = Guid.NewGuid();
    private static readonly Guid StoreB = Guid.NewGuid();
    private static readonly Guid Orphan = Guid.NewGuid();       // loja sem usuário

    private static string ConnectionString => DatabaseFixture.ConnectionStringFor(Database);

    private static string Script(string name) =>
        File.ReadAllText(Path.Combine(RepositoryRoot(), "backend", "deploy", "t18", name));

    public async Task InitializeAsync()
    {
        await RecreateDatabaseAsync(Database);
        await using var conn = await OpenAsync();
        await ExecuteAsync(conn, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Sql", "supabase-stub.sql")));
        await ExecuteAsync(conn, await File.ReadAllTextAsync(Path.Combine(RepositoryRoot(), "supabase", "schema.sql")));

        // Produção do V0: hash bcrypt no formato do Supabase ($2a$, custo 10).
        var hash = BCrypt.Net.BCrypt.HashPassword(V0Password, workFactor: 10);
        await using var seed = new NpgsqlCommand("""
            insert into auth.users (id, email, encrypted_password, email_confirmed_at, deleted_at) values
              (@owner, 'Dono@Loja.invalid', @hash, now(), null),
              (@unconfirmed, 'novo@loja.invalid', @hash, null, null),
              (@deleted, 'saiu@loja.invalid', @hash, now(), now());
            insert into petshops (id, name, email) values
              (@a, 'Pet A', 'a@loja.invalid'), (@b, 'Pet B', 'b@loja.invalid'), (@orphan, 'Pet test', 't@loja.invalid');
            insert into profiles (id, petshop_id) values (@owner, @a), (@unconfirmed, @b);
            insert into products (petshop_id, name, category, price, ean, source) values
              (@a, 'Ração X 1kg', 'Ração', 39.90, '7891000100103', 'barcode'),
              (@a, 'Coleira M', 'Acessórios', 29.90, null, 'manual'),
              (@b, 'Shampoo', 'Higiene', 19.90, null, 'manual');
            """, conn);
        seed.Parameters.AddWithValue("owner", Owner);
        seed.Parameters.AddWithValue("unconfirmed", Unconfirmed);
        seed.Parameters.AddWithValue("deleted", Deleted);
        seed.Parameters.AddWithValue("hash", hash);
        seed.Parameters.AddWithValue("a", StoreA);
        seed.Parameters.AddWithValue("b", StoreB);
        seed.Parameters.AddWithValue("orphan", Orphan);
        await seed.ExecuteNonQueryAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<NpgsqlConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        return conn;
    }

    private static async Task<List<object?[]>> QueryAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<object?[]>();
        while (await reader.ReadAsync())
        {
            var row = new object?[reader.FieldCount];
            for (var i = 0; i < row.Length; i++)
            {
                row[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            rows.Add(row);
        }
        return rows;
    }

    private static async Task RunCutoverAsync(NpgsqlConnection conn)
    {
        foreach (var step in new[]
                 {
                     "01-conferencia-antes.sql", "02-baseline.sql", "03-migrations-antes-da-importacao.sql",
                     "04-importar-contas.sql", "05-migrations-depois-da-importacao.sql", "06-conferencia-depois.sql",
                 })
        {
            await ExecuteAsync(conn, Script(step));
        }
    }

    [Fact]
    public async Task Virada_com_os_scripts_do_runbook()
    {
        await using var conn = await OpenAsync();

        // Antes: o hash é o do Supabase, e a conferência acha a loja sem usuário.
        var prefixes = await QueryAsync(conn, "select string_agg(distinct left(encrypted_password, 7), ',') from auth.users");
        Assert.Equal("$2a$10$", prefixes[0][0]);

        await RunCutoverAsync(conn);
        await RunCutoverAsync(conn); // rodar de novo é inofensivo (todos os passos idempotentes)

        // Nenhuma migration pendente: o passo 5 está em dia com Api/Data/Migrations.
        await using (var db = DatabaseFixture.Open(ConnectionString, new FixedTenant(null, null)))
        {
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        }

        // Conferências do passo 6.
        Assert.Empty(await QueryAsync(conn, """
            select u.id from auth.users u left join identity.users i on i.id = u.id
            where u.deleted_at is null and not coalesce(u.is_anonymous, false) and u.email is not null
              and (i.id is null or i.email_confirmed <> (u.email_confirmed_at is not null))
            """));
        Assert.Equal("identity.users",
            (await QueryAsync(conn, "select confrelid::regclass::text from pg_constraint where conname = 'profiles_id_fkey'"))[0][0]);
        var imported = await QueryAsync(conn, "select id, email, normalized_email, email_confirmed from identity.users order by email");
        Assert.Equal(2, imported.Count); // a conta apagada no Supabase não entra
        Assert.Contains(imported, r => (Guid)r[0]! == Owner && (string)r[1]! == "dono@loja.invalid"
                                        && (string)r[2]! == "DONO@LOJA.INVALID" && (bool)r[3]!);
        Assert.Contains(imported, r => (Guid)r[0]! == Unconfirmed && !(bool)r[3]!);
        var products = await QueryAsync(conn, "select petshop_id, count(*) from products group by petshop_id");
        Assert.Contains(products, r => (Guid)r[0]! == StoreA && (long)r[1]! == 2);
        Assert.Contains(products, r => (Guid)r[0]! == StoreB && (long)r[1]! == 1);
        Assert.Single(await QueryAsync(conn, $"select 1 from petshops where id = '{Orphan}'")); // nada apagado
    }

    [Fact]
    public async Task Depois_da_virada_as_contas_do_V0_entram_pela_API()
    {
        await using (var conn = await OpenAsync())
        {
            await RunCutoverAsync(conn);
        }

        var emails = new CapturingEmailSender();
        using var factory = new ApiFactory(
            connectionString: ConnectionString,
            settings: new Dictionary<string, string?> { ["Auth:RequireConfirmedEmail"] = "true" },
            configureServices: services =>
            {
                services.RemoveAll<IEmailSender>();
                services.AddSingleton<IEmailSender>(emails);
            });
        using var client = factory.CreateClient();

        // Dono do V0, com o e-mail em outra caixa e a senha de sempre.
        var login = await client.PostAsJsonAsync("/auth/login", new { email = "DONO@loja.invalid", password = V0Password });
        var session = await AuthApi.ReadSessionAsync(login);
        using var list = new HttpRequestMessage(HttpMethod.Get, "/products");
        list.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        var listed = await AuthApi.ReadAsync<List<ProductResponse>>(await client.SendAsync(list));
        Assert.Equal(["Coleira M", "Ração X 1kg"], listed.Select(p => p.Name));

        // A senha foi regravada no formato do Identity no primeiro login.
        await using (var conn = await OpenAsync())
        {
            var stored = (string)(await QueryAsync(conn, $"select password_hash from identity.users where id = '{Owner}'"))[0][0]!;
            Assert.False(stored.StartsWith("$2", StringComparison.Ordinal));
        }

        // Conta não confirmada: com a exigência ligada, não entra — e se recupera pelo e-mail.
        var blocked = await client.PostAsJsonAsync("/auth/login", new { email = "novo@loja.invalid", password = V0Password });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal("email_not_confirmed", await AuthApi.ReadCodeAsync(blocked));

        await client.PostAsJsonAsync("/auth/forgot-password", new { email = "novo@loja.invalid" });
        var link = ResetLink().Match(emails.Sent.Last(m => m.To == "novo@loja.invalid").Body);
        var reset = await client.PostAsJsonAsync("/auth/reset-password",
            new { userId = Guid.Parse(link.Groups["user"].Value), code = link.Groups["code"].Value, password = "senha-nova-123" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        var afterReset = await client.PostAsJsonAsync("/auth/login", new { email = "novo@loja.invalid", password = "senha-nova-123" });
        Assert.Equal(HttpStatusCode.OK, afterReset.StatusCode);

        // A conta apagada no Supabase não existe no Identity.
        var deleted = await client.PostAsJsonAsync("/auth/login", new { email = "saiu@loja.invalid", password = V0Password });
        Assert.Equal(HttpStatusCode.Unauthorized, deleted.StatusCode);
    }

    [Fact]
    public async Task Fechar_e_reabrir_a_Data_API()
    {
        await using var conn = await OpenAsync();
        await RunCutoverAsync(conn);
        const string check = "select has_table_privilege('authenticated', 'public.products', 'select')";
        Assert.True((bool)(await QueryAsync(conn, check))[0][0]!);

        await ExecuteAsync(conn, Script(Path.Combine("depois-da-observacao", "fechar-data-api.sql")));
        Assert.False((bool)(await QueryAsync(conn, check))[0][0]!);
        Assert.False((bool)(await QueryAsync(conn, "select has_table_privilege('anon', 'public.products', 'select')"))[0][0]!);

        await ExecuteAsync(conn, Script(Path.Combine("depois-da-observacao", "reabrir-data-api.sql")));
        Assert.True((bool)(await QueryAsync(conn, check))[0][0]!);
    }

    [GeneratedRegex(@"/redefinir-senha\?user=(?<user>[0-9a-f-]+)&code=(?<code>[A-Za-z0-9_-]+)")]
    private static partial Regex ResetLink();
}
