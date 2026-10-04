using System.Net;
using PetGest.Api.Models;
using PetGest.Api.Tests.Auth;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Catalog;

// Requisito "Busca por código de barras para o scanner" da spec api-products.
[Collection(DatabaseCollection.Name)]
public class ProductLookupTests(DatabaseFixture fixture) : IAsyncLifetime
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

    private Task<HttpResponseMessage> CreateAsync(string token, string name, string ean) =>
        _api.SendAsync(HttpMethod.Post, "/products", token, new { name, category = "Ração", price = 10, ean, source = "barcode" });

    private Task<HttpResponseMessage> LookupAsync(string token, string ean) =>
        _api.SendAsync(HttpMethod.Get, $"/products/by-ean/{ean}", token);

    [Fact]
    public async Task Codigo_ja_cadastrado_na_loja_devolve_o_produto()
    {
        await CreateAsync(_a, "Ração X 1kg", "7891000100103");

        var found = await AuthApi.ReadAsync<ProductResponse>(await LookupAsync(_a, "7891000100103"));

        Assert.Equal("Ração X 1kg", found.Name);
    }

    [Fact]
    public async Task Codigo_so_em_outra_loja_e_nao_encontrado()
    {
        await CreateAsync(_b, "Ração de B", "7891000100103");

        var response = await LookupAsync(_a, "7891000100103");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("product_not_found", await AuthApi.ReadCodeAsync(response));
    }

    [Fact]
    public async Task Codigo_cadastrado_por_outro_aparelho_da_loja_e_encontrado()
    {
        // Outro "aparelho": outra sessão da mesma conta, com outro cliente HTTP.
        var email = AuthApi.NewEmail();
        var phone = (await _api.SignupAsync(email)).AccessToken;
        using var otherDevice = new AuthApi(fixture);
        var laptop = (await AuthApi.ReadSessionAsync(await otherDevice.LoginAsync(email))).AccessToken;

        Assert.Equal(HttpStatusCode.NotFound, (await LookupAsync(phone, "78910001")).StatusCode);
        await otherDevice.SendAsync(HttpMethod.Post, "/products", laptop, new { name = "Petisco", category = "Petiscos", price = 5, ean = "78910001" });

        Assert.Equal(HttpStatusCode.OK, (await LookupAsync(phone, "78910001")).StatusCode);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("789100010010312")]
    [InlineData("7891000A00103")]
    public async Task Codigo_invalido_recebe_400(string ean)
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await LookupAsync(_a, ean)).StatusCode);
    }

    [Fact]
    public async Task Busca_sem_token_recebe_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await LookupAsync(null!, "7891000100103")).StatusCode);
    }
}
