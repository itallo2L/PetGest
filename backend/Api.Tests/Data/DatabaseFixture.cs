using Microsoft.EntityFrameworkCore;
using Npgsql;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Tests.Data;

// Banco `petgest_tests` no mesmo Postgres do docker-compose/CI, recriado e migrado uma
// vez por execução (design D7 da T-13). Cada teste cria os próprios petshops com Guids
// novos, então os testes não dependem de ordem nem de limpeza.
public class DatabaseFixture : IAsyncLifetime
{
    public const string ServerConnectionString =
        "Host=localhost;Port=5450;Username=petgest;Password=petgest_dev";

    public static string ConnectionStringFor(string database) =>
        new NpgsqlConnectionStringBuilder(ServerConnectionString) { Database = database }.ConnectionString;

    public string ConnectionString { get; } = ConnectionStringFor("petgest_tests");

    public async Task InitializeAsync()
    {
        await using var db = CreateContext(null, null);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public AppDbContext CreateContext(Guid? userId, Guid? petshopId) =>
        Open(ConnectionString, new FixedTenant(userId, petshopId));

    public AppDbContext As(TestTenant tenant) => CreateContext(tenant.UserId, tenant.PetshopId);

    public AppDbContext Anonymous() => CreateContext(null, null);

    public static AppDbContext Open(string connectionString, ITenantContext tenant) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options, tenant);

    // Petshop + vínculo criados como o cadastro da T-14 fará: contexto sem tenant, que
    // pode inserir Petshop/Profile (design D5).
    public async Task<TestTenant> SeedPetshopAsync(string name)
    {
        await using var db = Anonymous();
        var petshop = new Petshop { Name = name, Email = $"{Guid.NewGuid():N}@loja.invalid" };
        db.Petshops.Add(petshop);
        await db.SaveChangesAsync();

        var userId = await AddUserAsync(db);
        db.Profiles.Add(new Profile { Id = userId, PetshopId = petshop.Id });
        await db.SaveChangesAsync();

        return new TestTenant(userId, petshop.Id);
    }

    // Conta mínima em identity.users (profiles.id tem FK para ela desde a T-14).
    public static async Task<Guid> AddUserAsync(AppDbContext db, string? passwordHash = null)
    {
        var email = $"{Guid.NewGuid():N}@teste.invalid";
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString(),
            PasswordHash = passwordHash,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    public async Task<Product> AddProductAsync(TestTenant tenant, string name, string? ean = null)
    {
        await using var db = As(tenant);
        var product = new Product { Name = name, Category = "Ração", Price = 39.90m, Ean = ean };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product;
    }

    // Leitura sem filtro, para conferir o que de fato está no banco.
    public async Task<Product?> FindProductUnfilteredAsync(Guid id)
    {
        await using var db = Anonymous();
        return await db.Products.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(p => p.Id == id);
    }
}

public record TestTenant(Guid UserId, Guid PetshopId);

public class FixedTenant(Guid? userId, Guid? petshopId) : ITenantContext
{
    public Guid? UserId => userId;
    public Guid? PetshopId => petshopId;
}

[CollectionDefinition(Name)]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    public const string Name = "Database";
}
