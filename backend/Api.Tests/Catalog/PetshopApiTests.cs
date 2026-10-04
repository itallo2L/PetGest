using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Tests.Auth;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Catalog;

// Spec api-store: consultar, salvar e validar os dados da loja; criar a loja de uma
// conta sem loja.
[Collection(DatabaseCollection.Name)]
public class PetshopApiTests(DatabaseFixture fixture) : IAsyncLifetime
{
    private readonly AuthApi _api = new(fixture);
    private string _email = null!;
    private SessionResponse _a = null!;
    private string _b = null!;

    public async Task InitializeAsync()
    {
        _email = AuthApi.NewEmail();
        _a = await _api.SignupAsync(_email, petshopName: "Pet A");
        _b = (await _api.SignupAsync(petshopName: "Pet B")).AccessToken;
    }

    public Task DisposeAsync()
    {
        _api.Dispose();
        return Task.CompletedTask;
    }

    private Task<HttpResponseMessage> GetAsync(string token) => _api.SendAsync(HttpMethod.Get, "/petshop", token);

    private Task<HttpResponseMessage> PutAsync(string token, object body) => _api.SendAsync(HttpMethod.Put, "/petshop", token, body);

    // Conta sem loja (como uma importada do V0 sem ter concluído o cadastro).
    private async Task<SessionResponse> AccountWithoutStoreAsync()
    {
        await using var db = fixture.Anonymous();
        var userId = await DatabaseFixture.AddUserAsync(db, new CompatPasswordHasher().HashPassword(new AppUser(), AuthApi.Password));
        var email = (await db.Users.SingleAsync(u => u.Id == userId)).Email!;
        return await AuthApi.ReadSessionAsync(await _api.LoginAsync(email));
    }

    [Fact]
    public async Task Consulta_traz_os_dados_da_propria_loja()
    {
        var store = await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_a.AccessToken));

        Assert.Equal("Pet A", store.Name);
        Assert.Equal("loja@teste.invalid", store.Email);
        Assert.Null(store.Phone);
    }

    [Fact]
    public async Task Alterar_o_nome_e_consultar_de_novo()
    {
        var saved = await AuthApi.ReadAsync<PetshopResponse>(
            await PutAsync(_a.AccessToken, new { name = "  Pet Shop Amigo Fiel ", email = "contato@amigo.invalid", phone = " 11 3333-4444 " }));

        Assert.Equal("Pet Shop Amigo Fiel", saved.Name);
        Assert.Equal("11 3333-4444", saved.Phone);
        Assert.Equal(saved, await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_a.AccessToken)));
    }

    [Fact]
    public async Task Telefone_em_branco_deixa_a_loja_sem_telefone()
    {
        await PutAsync(_a.AccessToken, new { name = "Pet A", email = "a@t.invalid", phone = "11 9999-0000" });

        var saved = await AuthApi.ReadAsync<PetshopResponse>(await PutAsync(_a.AccessToken, new { name = "Pet A", email = "a@t.invalid", phone = "" }));

        Assert.Null(saved.Phone);
    }

    [Fact]
    public async Task Identificador_de_outra_loja_no_corpo_nao_altera_a_outra()
    {
        var storeB = await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_b));

        await PutAsync(_a.AccessToken, new { id = storeB.Id, name = "Hack", email = "h@x.invalid" });

        Assert.Equal("Pet B", (await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_b))).Name);
        Assert.Equal("Hack", (await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_a.AccessToken))).Name);
    }

    [Fact]
    public async Task Trocar_o_email_da_loja_nao_muda_o_email_de_acesso()
    {
        await PutAsync(_a.AccessToken, new { name = "Pet A", email = "novo-contato@loja.invalid" });

        Assert.Equal(HttpStatusCode.OK, (await _api.LoginAsync(_email)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.LoginAsync("novo-contato@loja.invalid")).StatusCode);
    }

    [Theory]
    [InlineData("   ", "a@t.invalid", "name")]
    [InlineData("Pet", "contato@", "email")]
    [InlineData("Pet", "", "email")]
    public async Task Dados_invalidos_recebem_400_sem_gravar(string name, string email, string field)
    {
        var response = await PutAsync(_a.AccessToken, new { name, email });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Contains(field, problem.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name.ToLowerInvariant()));
        Assert.Equal("Pet A", (await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(_a.AccessToken))).Name);
    }

    [Fact]
    public async Task Conta_sem_loja_recebe_404_na_consulta_e_na_gravacao()
    {
        var session = await AccountWithoutStoreAsync();

        var get = await GetAsync(session.AccessToken);
        var put = await PutAsync(session.AccessToken, new { name = "Pet", email = "p@t.invalid" });

        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
        Assert.Equal("petshop_not_found", await AuthApi.ReadCodeAsync(get));
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }

    [Fact]
    public async Task Conta_sem_loja_cria_a_loja_e_a_renovacao_traz_o_petshop()
    {
        var session = await AccountWithoutStoreAsync();

        var created = await AuthApi.ReadAsync<PetshopCreatedResponse>(
            await _api.SendAsync(HttpMethod.Post, "/petshop", session.AccessToken, new { name = " Pet Novo ", email = "novo@t.invalid", phone = "" }),
            HttpStatusCode.Created);

        Assert.Equal("Pet Novo", created.Name);
        Assert.Null(created.Phone);
        Assert.True(created.SessionRenewalRequired);
        var renewed = await AuthApi.ReadSessionAsync(await _api.RefreshAsync(session.RefreshToken));
        Assert.Equal(created.Id.ToString(), AuthApi.Decode(renewed.AccessToken).GetClaim("petshop_id").Value);
        Assert.Equal("Pet Novo", (await AuthApi.ReadAsync<PetshopResponse>(await GetAsync(renewed.AccessToken))).Name);
    }

    [Fact]
    public async Task Conta_que_ja_tem_loja_recebe_409_e_nada_e_criado()
    {
        await using var db = fixture.Anonymous();
        var before = await db.Petshops.IgnoreQueryFilters().CountAsync();

        var response = await _api.SendAsync(HttpMethod.Post, "/petshop", _a.AccessToken, new { name = "Segunda", email = "s@t.invalid" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("petshop_exists", await AuthApi.ReadCodeAsync(response));
        Assert.Equal(before, await db.Petshops.IgnoreQueryFilters().CountAsync());
    }
}
