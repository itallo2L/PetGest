using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data;

// Isolamento por petshop (design D5 da T-13): filtros globais na leitura e
// TenantWriteGuard na gravação. Os dois valem para qualquer instância do contexto,
// por isso ficam aqui e não no registro do Program.cs.
// Contas do Identity sem papéis (papel único — design D1 da T-14), no schema `identity`.
// As tabelas do Identity não têm filtro de tenant: o login precisa achar o usuário.
// As chaves do Data Protection também moram aqui (design D1 da T-17), para os códigos
// enviados por e-mail continuarem válidos depois de um reinício ou novo deploy.
public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenant)
    : IdentityUserContext<AppUser, Guid>(options), IDataProtectionKeyContext
{
    private static readonly TenantWriteGuard WriteGuard = new();

    public DbSet<Petshop> Petshops => Set<Petshop>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    // Os filtros referenciam estas propriedades (e não variáveis capturadas) para o EF
    // ler o valor de cada instância; uma variável congelaria o tenant no modelo em cache.
    public Guid? CurrentUserId => tenant.UserId;
    public Guid? CurrentPetshopId => tenant.PetshopId;

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(WriteGuard);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Sem petshop/usuário, a comparação com null não casa com nenhuma linha
        // (colunas NOT NULL): anônimo e usuário sem vínculo não veem nada.
        modelBuilder.Entity<Product>().HasQueryFilter(p => p.PetshopId == CurrentPetshopId);
        modelBuilder.Entity<Petshop>().HasQueryFilter(p => p.Id == CurrentPetshopId);
        modelBuilder.Entity<Profile>().HasQueryFilter(p => p.Id == CurrentUserId);
    }
}
