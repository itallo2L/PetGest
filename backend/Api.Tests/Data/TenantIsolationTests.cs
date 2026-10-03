using Microsoft.EntityFrameworkCore;
using Npgsql;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Tests.Data;

// Casos de supabase/tests/rls_test.sql portados para a API (design D7 da T-13): requisitos
// "Leitura isolada por petshop", "Gravação sempre no próprio petshop" e "Vínculo
// usuário → petshop imutável" da spec api-tenant-data.
[Collection(DatabaseCollection.Name)]
public class TenantIsolationTests(DatabaseFixture fixture) : IAsyncLifetime
{
    private TestTenant _a = null!;
    private TestTenant _b = null!;

    public async Task InitializeAsync()
    {
        _a = await fixture.SeedPetshopAsync("Pet A");
        _b = await fixture.SeedPetshopAsync("Pet B");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ---- Leitura -------------------------------------------------------------------

    [Fact]
    public void Consulta_de_produtos_traz_o_filtro_por_petshop_parametrizado()
    {
        using var db = fixture.As(_b);
        var sql = db.Products.ToQueryString();

        Assert.Contains("petshop_id", sql);
        Assert.Contains(_b.PetshopId.ToString(), sql);
    }

    [Fact]
    public async Task Listagem_traz_so_os_produtos_do_proprio_petshop()
    {
        await fixture.AddProductAsync(_a, "Ração X (A)");
        await fixture.AddProductAsync(_b, "Banho P");
        await fixture.AddProductAsync(_b, "Banho M");

        await using var db = fixture.As(_b);
        var products = await db.Products.ToListAsync();

        Assert.Equal(2, products.Count);
        Assert.All(products, p => Assert.Equal(_b.PetshopId, p.PetshopId));
    }

    [Fact]
    public async Task Busca_por_ean_traz_so_o_produto_do_proprio_petshop()
    {
        await fixture.AddProductAsync(_a, "Ração X 1kg", "7891000100103");
        await fixture.AddProductAsync(_b, "Ração X 1kg (B)", "7891000100103");

        await using var db = fixture.As(_b);
        var found = await db.Products.SingleAsync(p => p.Ean == "7891000100103");

        Assert.Equal("Ração X 1kg (B)", found.Name);
    }

    [Fact]
    public async Task Ve_so_o_proprio_petshop_e_o_proprio_vinculo()
    {
        await using var db = fixture.As(_b);

        var petshop = Assert.Single(await db.Petshops.ToListAsync());
        Assert.Equal(_b.PetshopId, petshop.Id);
        var profile = Assert.Single(await db.Profiles.ToListAsync());
        Assert.Equal(_b.UserId, profile.Id);
    }

    [Fact]
    public async Task Produto_de_outro_petshop_pelo_id_nao_e_encontrado()
    {
        var productA = await fixture.AddProductAsync(_a, "Ração X (A)");

        await using var db = fixture.As(_b);

        Assert.Null(await db.Products.FindAsync(productA.Id));
        Assert.Null(await db.Products.SingleOrDefaultAsync(p => p.Id == productA.Id));
    }

    [Fact]
    public async Task Usuario_sem_petshop_nao_ve_nada()
    {
        await fixture.AddProductAsync(_a, "Ração X (A)");

        await using var db = fixture.CreateContext(Guid.NewGuid(), null);

        Assert.Empty(await db.Products.ToListAsync());
        Assert.Empty(await db.Petshops.ToListAsync());
        Assert.Empty(await db.Profiles.ToListAsync());
    }

    [Fact]
    public async Task Anonimo_nao_ve_nada()
    {
        await fixture.AddProductAsync(_a, "Ração X (A)");

        await using var db = fixture.Anonymous();

        Assert.Empty(await db.Products.ToListAsync());
        Assert.Empty(await db.Petshops.ToListAsync());
        Assert.Empty(await db.Profiles.ToListAsync());
    }

    // ---- Gravação ------------------------------------------------------------------

    [Fact]
    public async Task Cadastro_sem_informar_o_petshop_cai_no_proprio_petshop()
    {
        var product = await fixture.AddProductAsync(_a, "Ração X 1kg", "7891000100103");

        var stored = await fixture.FindProductUnfilteredAsync(product.Id);
        Assert.Equal(_a.PetshopId, stored!.PetshopId);
    }

    [Fact]
    public async Task Cadastro_informando_outro_petshop_e_recusado()
    {
        await using var db = fixture.As(_b);
        var invasor = new Product { PetshopId = _a.PetshopId, Name = "Invasor", Category = "X", Price = 1 };
        db.Products.Add(invasor);

        await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        Assert.Null(await fixture.FindProductUnfilteredAsync(invasor.Id));
    }

    [Fact]
    public async Task Mover_produto_para_outro_petshop_e_recusado()
    {
        var product = await fixture.AddProductAsync(_b, "Banho P");

        await using (var db = fixture.As(_b))
        {
            var own = await db.Products.SingleAsync(p => p.Id == product.Id);
            own.PetshopId = _a.PetshopId;
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        Assert.Equal(_b.PetshopId, (await fixture.FindProductUnfilteredAsync(product.Id))!.PetshopId);
    }

    [Fact]
    public async Task Alterar_produto_alheio_anexado_a_mao_e_recusado()
    {
        var productA = await fixture.AddProductAsync(_a, "Ração X (A)");

        // Com o petshop verdadeiro (A): o interceptador recusa.
        await using (var db = fixture.As(_b))
        {
            db.Products.Update(new Product
            {
                Id = productA.Id, PetshopId = _a.PetshopId, Name = "Hack", Category = "X", Price = 0,
            });
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        // Dizendo ser do próprio petshop (B): o UPDATE sai com petshop_id = B no WHERE e
        // não alcança a linha de A.
        await using (var db = fixture.As(_b))
        {
            db.Products.Update(new Product
            {
                Id = productA.Id, PetshopId = _b.PetshopId, Name = "Hack", Category = "X", Price = 0,
            });
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => db.SaveChangesAsync());
        }

        var stored = await fixture.FindProductUnfilteredAsync(productA.Id);
        Assert.Equal("Ração X (A)", stored!.Name);
        Assert.Equal(39.90m, stored.Price);
        Assert.Equal(_a.PetshopId, stored.PetshopId);
    }

    [Fact]
    public async Task Excluir_produto_alheio_anexado_a_mao_e_recusado()
    {
        var productA = await fixture.AddProductAsync(_a, "Ração X (A)");

        await using (var db = fixture.As(_b))
        {
            db.Products.Remove(new Product { Id = productA.Id, PetshopId = _a.PetshopId, Name = "-", Category = "-" });
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        await using (var db = fixture.As(_b))
        {
            db.Products.Remove(new Product { Id = productA.Id, PetshopId = _b.PetshopId, Name = "-", Category = "-" });
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => db.SaveChangesAsync());
        }

        Assert.NotNull(await fixture.FindProductUnfilteredAsync(productA.Id));
    }

    [Fact]
    public async Task Alterar_os_dados_da_propria_loja_e_permitido()
    {
        await using (var db = fixture.As(_b))
        {
            var petshop = await db.Petshops.SingleAsync();
            petshop.Phone = "11 3333-4444";
            await db.SaveChangesAsync();
        }

        await using var check = fixture.As(_b);
        Assert.Equal("11 3333-4444", (await check.Petshops.SingleAsync()).Phone);
    }

    [Fact]
    public async Task Alterar_ou_excluir_outra_loja_e_recusado()
    {
        await using (var db = fixture.As(_b))
        {
            db.Petshops.Update(new Petshop { Id = _a.PetshopId, Name = "Hack", Email = "h@x.invalid" });
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        await using (var db = fixture.As(_b))
        {
            db.Petshops.Remove(new Petshop { Id = _a.PetshopId, Name = "-", Email = "-" });
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        await using var check = fixture.As(_a);
        Assert.Equal("Pet A", (await check.Petshops.SingleAsync()).Name);
    }

    [Fact]
    public async Task Trocar_o_proprio_vinculo_e_recusado()
    {
        await using (var db = fixture.As(_b))
        {
            var profile = await db.Profiles.SingleAsync();
            profile.PetshopId = _a.PetshopId;
            await Assert.ThrowsAsync<TenantViolationException>(() => db.SaveChangesAsync());
        }

        await using var check = fixture.As(_b);
        Assert.Equal(_b.PetshopId, (await check.Profiles.SingleAsync()).PetshopId);
    }

    [Fact]
    public async Task Segundo_vinculo_para_o_mesmo_usuario_falha_com_duplicidade()
    {
        await using var db = fixture.Anonymous();
        db.Profiles.Add(new Profile { Id = _b.UserId, PetshopId = _a.PetshopId });

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    [Fact]
    public async Task Cadastro_de_produto_sem_petshop_e_recusado()
    {
        await using (var semPetshop = fixture.CreateContext(Guid.NewGuid(), null))
        {
            semPetshop.Products.Add(new Product { Name = "X", Category = "X", Price = 1 });
            await Assert.ThrowsAsync<TenantViolationException>(() => semPetshop.SaveChangesAsync());
        }

        await using var anonimo = fixture.Anonymous();
        anonimo.Products.Add(new Product { Name = "X", Category = "X", Price = 1 });
        await Assert.ThrowsAsync<TenantViolationException>(() => anonimo.SaveChangesAsync());
    }
}
