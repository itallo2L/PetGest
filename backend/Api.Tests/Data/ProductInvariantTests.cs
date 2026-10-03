using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Tests.Data;

// Requisitos "Invariantes do produto garantidas pelo banco", "Origem do produto e
// resposta bruta da IA" e "Datas de criação e atualização automáticas" da spec
// api-tenant-data.
[Collection(DatabaseCollection.Name)]
public class ProductInvariantTests(DatabaseFixture fixture) : IAsyncLifetime
{
    private TestTenant _a = null!;

    public async Task InitializeAsync() => _a = await fixture.SeedPetshopAsync("Pet A");

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<string> SaveAndGetSqlStateAsync(Product product)
    {
        await using var db = fixture.As(_a);
        db.Products.Add(product);
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        return Assert.IsType<PostgresException>(error.InnerException).SqlState;
    }

    // ---- Código de barras ----------------------------------------------------------

    [Fact]
    public async Task Codigo_repetido_no_mesmo_petshop_falha_com_duplicidade()
    {
        await fixture.AddProductAsync(_a, "Ração X 1kg", "7891000100103");

        var state = await SaveAndGetSqlStateAsync(
            new Product { Name = "Duplicado", Category = "Ração", Price = 1, Ean = "7891000100103" });

        Assert.Equal(PostgresErrorCodes.UniqueViolation, state);
    }

    [Fact]
    public async Task Mesmo_codigo_em_petshops_diferentes_e_aceito()
    {
        var b = await fixture.SeedPetshopAsync("Pet B");

        await fixture.AddProductAsync(_a, "Ração X 1kg", "7891000100103");
        await fixture.AddProductAsync(b, "Ração X 1kg (B)", "7891000100103");
    }

    [Fact]
    public async Task Varios_produtos_sem_codigo_sao_aceitos()
    {
        await fixture.AddProductAsync(_a, "Banho P");
        await fixture.AddProductAsync(_a, "Banho M");

        await using var db = fixture.As(_a);
        Assert.Equal(2, await db.Products.CountAsync(p => p.Ean == null));
    }

    // ---- Valores inválidos ---------------------------------------------------------

    [Theory]
    [InlineData("Ração", "Ração", -0.01, null)]
    [InlineData("   ", "Ração", 1, null)]
    [InlineData("Ração", " ", 1, null)]
    [InlineData("Ração", "Ração", 1, "123")]
    [InlineData("Ração", "Ração", 1, "789100010010312")]
    [InlineData("Ração", "Ração", 1, "7891000A00103")]
    public async Task Valores_invalidos_sao_recusados_pelo_banco(string name, string category, double price, string? ean)
    {
        var product = new Product { Name = name, Category = category, Price = (decimal)price, Ean = ean };

        Assert.Equal(PostgresErrorCodes.CheckViolation, await SaveAndGetSqlStateAsync(product));
    }

    [Theory]
    [InlineData("78910001")]
    [InlineData("78910001001031")]
    public async Task Codigo_de_8_a_14_digitos_e_aceito(string ean)
    {
        await fixture.AddProductAsync(_a, "Ração", ean);
    }

    // ---- Origem e resposta da IA ---------------------------------------------------

    [Theory]
    [InlineData(ProductSource.PhotoAI)]
    [InlineData(ProductSource.VoiceAI)]
    public async Task Produto_de_IA_guarda_a_resposta_bruta(ProductSource source)
    {
        var raw = JsonDocument.Parse("""{"name":"Ração X 1kg","price":39.9,"confidence":0.92}""");
        Guid id;
        await using (var db = fixture.As(_a))
        {
            var product = new Product
            {
                Name = "Ração X 1kg", Category = "Ração", Price = 39.90m, Source = source, AiRawResponse = raw,
            };
            db.Products.Add(product);
            await db.SaveChangesAsync();
            id = product.Id;
        }

        await using var read = fixture.As(_a);
        var stored = await read.Products.SingleAsync(p => p.Id == id);
        Assert.Equal(source, stored.Source);
        Assert.Equal("Ração X 1kg", stored.AiRawResponse!.RootElement.GetProperty("name").GetString());
        Assert.Equal(0.92, stored.AiRawResponse.RootElement.GetProperty("confidence").GetDouble());
    }

    [Theory]
    [InlineData(ProductSource.Manual)]
    [InlineData(ProductSource.Barcode)]
    public async Task Produto_manual_ou_por_codigo_com_resposta_da_IA_e_recusado(ProductSource source)
    {
        var state = await SaveAndGetSqlStateAsync(new Product
        {
            Name = "Ração", Category = "Ração", Price = 1, Source = source,
            AiRawResponse = JsonDocument.Parse("""{"name":"Ração"}"""),
        });

        Assert.Equal(PostgresErrorCodes.CheckViolation, state);
    }

    [Fact]
    public async Task Origem_nao_informada_e_manual()
    {
        var product = await fixture.AddProductAsync(_a, "Banho P");

        await using var db = fixture.Anonymous();
        var source = await db.Database
            .SqlQuery<string>($"select source as \"Value\" from products where id = {product.Id}")
            .SingleAsync();
        Assert.Equal("manual", source);
    }

    [Fact]
    public async Task Origem_fora_da_lista_e_recusada()
    {
        // Pela API: o valor não tem tradução para o banco.
        await using (var db = fixture.As(_a))
        {
            db.Products.Add(new Product { Name = "X", Category = "X", Price = 1, Source = (ProductSource)99 });
            var apiError = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.IsType<ArgumentOutOfRangeException>(apiError.InnerException);
        }

        // Direto no banco: o check recusa.
        await using var raw = fixture.Anonymous();
        var error = await Assert.ThrowsAsync<PostgresException>(() => raw.Database.ExecuteSqlAsync(
            $"insert into products (petshop_id, name, category, price, source) values ({_a.PetshopId}, 'X', 'X', 1, 'xyz')"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
    }

    [Fact]
    public async Task Produto_gravado_pelo_V0_continua_legivel()
    {
        var id = Guid.NewGuid();
        await using (var raw = fixture.Anonymous())
        {
            await raw.Database.ExecuteSqlAsync(
                $"insert into products (id, petshop_id, name, category, price, ean, source) values ({id}, {_a.PetshopId}, 'Ração X 1kg', 'Ração', 39.90, '7891000100103', 'barcode')");
        }

        await using var db = fixture.As(_a);
        var product = await db.Products.SingleAsync(p => p.Id == id);
        Assert.Equal(ProductSource.Barcode, product.Source);
        Assert.Null(product.AiRawResponse);
    }

    // ---- Datas ---------------------------------------------------------------------

    [Fact]
    public async Task Datas_de_criacao_sao_preenchidas_pelo_banco()
    {
        var product = await fixture.AddProductAsync(_a, "Banho P");

        Assert.NotEqual(default, product.CreatedAt);
        Assert.NotEqual(default, product.UpdatedAt);

        await using var db = fixture.As(_a);
        Assert.NotEqual(default, (await db.Petshops.SingleAsync()).CreatedAt);
        Assert.NotEqual(default, (await db.Profiles.SingleAsync()).CreatedAt);
    }

    [Fact]
    public async Task Edicao_atualiza_updated_at_mesmo_enviando_data_antiga()
    {
        var product = await fixture.AddProductAsync(_a, "Banho P");

        // Pela API: a coluna é gerada pelo banco e o valor novo volta no RETURNING.
        await using (var db = fixture.As(_a))
        {
            var own = await db.Products.SingleAsync(p => p.Id == product.Id);
            own.Price = 55;
            own.UpdatedAt = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);
            await db.SaveChangesAsync();
            Assert.True(own.UpdatedAt > product.UpdatedAt);
        }

        // Direto no banco: o trigger reescreve a data antiga.
        await using (var raw = fixture.Anonymous())
        {
            await raw.Database.ExecuteSqlAsync(
                $"update products set price = 42, updated_at = '2000-01-01' where id = {product.Id}");
        }

        var stored = await fixture.FindProductUnfilteredAsync(product.Id);
        Assert.True(stored!.UpdatedAt > new DateTimeOffset(2001, 1, 1, 0, 0, 0, TimeSpan.Zero));
    }
}
