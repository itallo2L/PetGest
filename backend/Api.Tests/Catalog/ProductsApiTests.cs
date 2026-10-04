using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Tests.Auth;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Catalog;

// Spec api-products: listagem, consulta, cadastro, validação, conflito de código,
// edição e exclusão — sempre pela API, com lojas A e B criadas por cadastro.
[Collection(DatabaseCollection.Name)]
public class ProductsApiTests(DatabaseFixture fixture) : IAsyncLifetime
{
    private readonly AuthApi _api = new(fixture);
    private string _a = null!;
    private string _b = null!;

    public async Task InitializeAsync()
    {
        _a = (await _api.SignupAsync(petshopName: "Pet A")).AccessToken;
        _b = (await _api.SignupAsync(petshopName: "Pet B")).AccessToken;
    }

    public Task DisposeAsync()
    {
        _api.Dispose();
        return Task.CompletedTask;
    }

    private Task<HttpResponseMessage> Post(string token, object body) => _api.SendAsync(HttpMethod.Post, "/products", token, body);

    private async Task<ProductResponse> CreateAsync(string token, string name, string? ean = null, decimal price = 39.90m, string? source = null) =>
        await AuthApi.ReadAsync<ProductResponse>(
            await Post(token, new { name, category = "Ração", price, ean, source }), HttpStatusCode.Created);

    private async Task<List<ProductResponse>> ListAsync(string token) =>
        await AuthApi.ReadAsync<List<ProductResponse>>(await _api.SendAsync(HttpMethod.Get, "/products", token));

    private static string PetshopOf(string token) => AuthApi.Decode(token).GetClaim("petshop_id").Value;

    // ---- Listagem e consulta -------------------------------------------------------

    [Fact]
    public async Task Listagem_traz_so_os_produtos_da_loja_em_ordem_de_nome()
    {
        await CreateAsync(_a, "Ração X");
        await CreateAsync(_a, "Banho P");
        await CreateAsync(_a, "Coleira M");
        await CreateAsync(_b, "Produto de B");

        var products = await ListAsync(_a);

        Assert.Equal(["Banho P", "Coleira M", "Ração X"], products.Select(p => p.Name));
    }

    [Fact]
    public async Task Loja_sem_produtos_recebe_lista_vazia()
    {
        Assert.Empty(await ListAsync(_a));
    }

    [Fact]
    public async Task Listagem_sem_token_recebe_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.SendAsync(HttpMethod.Get, "/products", null)).StatusCode);
    }

    [Fact]
    public async Task Consulta_de_produto_da_loja()
    {
        var created = await CreateAsync(_a, "Ração X");

        var found = await AuthApi.ReadAsync<ProductResponse>(await _api.SendAsync(HttpMethod.Get, $"/products/{created.Id}", _a));

        Assert.Equal(created, found);
    }

    [Fact]
    public async Task Produto_de_outra_loja_e_produto_inexistente_tem_o_mesmo_404()
    {
        var fromB = await CreateAsync(_b, "Produto de B");

        var other = await _api.SendAsync(HttpMethod.Get, $"/products/{fromB.Id}", _a);
        var missing = await _api.SendAsync(HttpMethod.Get, $"/products/{Guid.NewGuid()}", _a);

        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("product_not_found", await AuthApi.ReadCodeAsync(other));
        Assert.Equal("product_not_found", await AuthApi.ReadCodeAsync(missing));
    }

    // ---- Cadastro ------------------------------------------------------------------

    [Fact]
    public async Task Cadastro_valido_sem_codigo_fica_manual_e_aparece_na_lista()
    {
        var created = await CreateAsync(_a, "  Coleira Nylon M  ", price: 29.90m);

        Assert.Equal("Coleira Nylon M", created.Name);
        Assert.Equal(29.90m, created.Price);
        Assert.Null(created.Ean);
        Assert.Equal("manual", created.Source);
        Assert.Contains(await ListAsync(_a), p => p.Id == created.Id);
    }

    [Fact]
    public async Task Cadastro_depois_de_escanear_fica_barcode()
    {
        Assert.Equal("barcode", (await CreateAsync(_a, "Ração", "7891000100103", source: "barcode")).Source);
    }

    [Fact]
    public async Task Codigo_vazio_vira_ausente()
    {
        Assert.Null((await CreateAsync(_a, "Banho", ean: "")).Ean);
    }

    [Fact]
    public async Task Petshop_informado_no_corpo_e_ignorado()
    {
        var created = await AuthApi.ReadAsync<ProductResponse>(
            await Post(_a, new { name = "Invasor", category = "X", price = 1, petshopId = PetshopOf(_b) }), HttpStatusCode.Created);

        await using var db = fixture.Anonymous();
        var stored = await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == created.Id);
        Assert.Equal(PetshopOf(_a), stored.PetshopId.ToString());
        Assert.DoesNotContain(await ListAsync(_b), p => p.Id == created.Id);
    }

    [Theory]
    [InlineData("photo_ai")]
    [InlineData("voice_ai")]
    [InlineData("qualquer")]
    public async Task Origem_fora_de_barcode_e_manual_e_recusada(string source)
    {
        var response = await Post(_a, new { name = "X", category = "X", price = 1, source });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await ListAsync(_a));
    }

    [Fact]
    public async Task Conta_sem_loja_nao_cadastra_produto()
    {
        string token;
        await using (var db = fixture.Anonymous())
        {
            var userId = await DatabaseFixture.AddUserAsync(db, new CompatPasswordHasher().HashPassword(new AppUser(), AuthApi.Password));
            token = (await AuthApi.ReadSessionAsync(await _api.LoginAsync((await db.Users.SingleAsync(u => u.Id == userId)).Email!))).AccessToken;
        }

        var response = await Post(token, new { name = "X", category = "X", price = 1 });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("petshop_required", await AuthApi.ReadCodeAsync(response));
    }

    // ---- Validação -----------------------------------------------------------------

    public static TheoryData<object, string> InvalidProducts => new()
    {
        { new { name = "X", category = "X", price = -1m }, "price" },
        { new { name = "X", category = "X", price = 10.999m }, "price" },
        { new { name = "X", category = "X", price = 100_000_000m }, "price" },
        { new { name = "X", category = "X" }, "price" },
        { new { name = "   ", category = "X", price = 1m }, "name" },
        { new { name = new string('a', 201), category = "X", price = 1m }, "name" },
        { new { name = "X", category = " ", price = 1m }, "category" },
        { new { name = "X", category = "X", price = 1m, ean = "12345" }, "ean" },
        { new { name = "X", category = "X", price = 1m, ean = "7891000A00103" }, "ean" },
    };

    [Theory]
    [MemberData(nameof(InvalidProducts))]
    public async Task Produto_invalido_recebe_400_indicando_o_campo(object body, string field)
    {
        var response = await Post(_a, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var fields = problem.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name.ToLowerInvariant());
        Assert.Contains(field, fields);
        Assert.Empty(await ListAsync(_a));
    }

    [Fact]
    public async Task Categoria_fora_da_lista_do_frontend_e_aceita()
    {
        Assert.Equal("Serviço", (await AuthApi.ReadAsync<ProductResponse>(
            await Post(_a, new { name = "Banho", category = "Serviço", price = 50 }), HttpStatusCode.Created)).Category);
    }

    // ---- Conflito de código --------------------------------------------------------

    [Fact]
    public async Task Codigo_repetido_na_loja_da_409_com_o_produto_dono()
    {
        var owner = await CreateAsync(_a, "Ração Golden Adultos Frango 15kg", "7891000100103");

        var response = await Post(_a, new { name = "Outro", category = "Ração", price = 1, ean = "7891000100103" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ean_taken", problem.RootElement.GetProperty("code").GetString());
        Assert.Equal(owner.Id, problem.RootElement.GetProperty("product").GetProperty("id").GetGuid());
        Assert.Equal("Ração Golden Adultos Frango 15kg", problem.RootElement.GetProperty("product").GetProperty("name").GetString());
        Assert.Single(await ListAsync(_a));
    }

    [Fact]
    public async Task Mesmo_codigo_em_outra_loja_e_aceito()
    {
        await CreateAsync(_b, "Ração de B", "7891000100103");

        Assert.Equal("7891000100103", (await CreateAsync(_a, "Ração de A", "7891000100103")).Ean);
    }

    // ---- Edição --------------------------------------------------------------------

    private Task<HttpResponseMessage> Put(string token, Guid id, object body) =>
        _api.SendAsync(HttpMethod.Put, $"/products/{id}", token, body);

    [Fact]
    public async Task Edicao_grava_e_atualiza_a_data_mantendo_a_origem()
    {
        var created = await CreateAsync(_a, "Ração", "7891000100103", source: "barcode");

        var updated = await AuthApi.ReadAsync<ProductResponse>(
            await Put(_a, created.Id, new { name = "Ração", category = "Ração", price = 34.90m, ean = "7891000100103" }));

        Assert.Equal(34.90m, updated.Price);
        Assert.Equal("barcode", updated.Source);
        Assert.True(updated.UpdatedAt > created.UpdatedAt);
    }

    [Fact]
    public async Task Edicao_para_codigo_usado_da_409_e_nao_altera()
    {
        await CreateAsync(_a, "Dono do código", "7891000100103");
        var other = await CreateAsync(_a, "Outro", "78910001");

        var response = await Put(_a, other.Id, new { name = "Outro", category = "Ração", price = 1, ean = "7891000100103" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("ean_taken", await AuthApi.ReadCodeAsync(response));
        var stored = await AuthApi.ReadAsync<ProductResponse>(await _api.SendAsync(HttpMethod.Get, $"/products/{other.Id}", _a));
        Assert.Equal("78910001", stored.Ean);
    }

    [Fact]
    public async Task Edicao_mantendo_o_proprio_codigo_e_aceita()
    {
        var created = await CreateAsync(_a, "Ração", "7891000100103");

        var response = await Put(_a, created.Id, new { name = "Ração nova", category = "Ração", price = 1, ean = "7891000100103" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Edicao_de_produto_de_outra_loja_da_404_e_nao_altera()
    {
        var fromB = await CreateAsync(_b, "Produto de B");

        var response = await Put(_a, fromB.Id, new { name = "Hack", category = "X", price = 0 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("product_not_found", await AuthApi.ReadCodeAsync(response));
        Assert.Equal("Produto de B", (await ListAsync(_b)).Single().Name);
    }

    [Fact]
    public async Task Edicao_invalida_recebe_400()
    {
        var created = await CreateAsync(_a, "Ração");

        Assert.Equal(HttpStatusCode.BadRequest,
            (await Put(_a, created.Id, new { name = "Ração", category = "Ração", price = -5 })).StatusCode);
    }

    // ---- Exclusão ------------------------------------------------------------------

    [Fact]
    public async Task Exclusao_remove_o_produto_da_loja()
    {
        var created = await CreateAsync(_a, "Ração");

        Assert.Equal(HttpStatusCode.NoContent, (await _api.SendAsync(HttpMethod.Delete, $"/products/{created.Id}", _a)).StatusCode);
        Assert.Empty(await ListAsync(_a));
    }

    [Fact]
    public async Task Exclusao_de_produto_de_outra_loja_da_404_e_nao_exclui()
    {
        var fromB = await CreateAsync(_b, "Produto de B");

        var response = await _api.SendAsync(HttpMethod.Delete, $"/products/{fromB.Id}", _a);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Single(await ListAsync(_b));
    }
}
