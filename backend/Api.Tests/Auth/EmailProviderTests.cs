using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using PetGest.Api.Services;

namespace PetGest.Api.Tests.Auth;

// Envio real pelo Azure Communication Services e validação da configuração (design D1
// da T-22). Sem rede: o HttpMessageHandler falso recebe a requisição que iria ao Azure.
public class EmailProviderTests
{
    private static readonly byte[] AccessKey = Encoding.UTF8.GetBytes("chave-de-teste-do-communication-services");

    private static readonly string ConnectionString =
        $"endpoint=https://petgest-teste.communication.azure.com/;accesskey={Convert.ToBase64String(AccessKey)}";

    private sealed class RecordingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public byte[] Body { get; private set; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Body = await request.Content!.ReadAsByteArrayAsync(ct);
            return new HttpResponseMessage(status) { Content = new StringContent("{\"error\":{\"code\":\"x\"}}") };
        }
    }

    private static (AcsEmailSender Sender, RecordingHandler Handler, FakeTimeProvider Time) CreateSender(HttpStatusCode status)
    {
        var handler = new RecordingHandler(status);
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 7, 3, 0, 0, TimeSpan.Zero));
        var settings = Options.Create(new EmailSettings
        {
            Provider = "acs",
            AcsConnectionString = ConnectionString,
            Sender = "DoNotReply@exemplo.azurecomm.net",
        });
        return (new AcsEmailSender(new HttpClient(handler), settings, time), handler, time);
    }

    [Fact]
    public async Task Envio_vai_assinado_para_o_endpoint_do_recurso()
    {
        var (sender, handler, _) = CreateSender(HttpStatusCode.Accepted);

        await sender.SendAsync(new EmailMessage("dono@loja.invalid", "Assunto", "Texto", "<p>Html</p>"), CancellationToken.None);

        var request = handler.Request!;
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://petgest-teste.communication.azure.com/emails:send?api-version=2023-03-31", request.RequestUri!.ToString());

        var date = request.Headers.GetValues("x-ms-date").Single();
        Assert.Equal("Wed, 07 Oct 2026 03:00:00 GMT", date);
        var hash = Convert.ToBase64String(SHA256.HashData(handler.Body));
        Assert.Equal(hash, request.Headers.GetValues("x-ms-content-sha256").Single());

        var stringToSign = $"POST\n/emails:send?api-version=2023-03-31\n{date};petgest-teste.communication.azure.com;{hash}";
        var signature = Convert.ToBase64String(HMACSHA256.HashData(AccessKey, Encoding.UTF8.GetBytes(stringToSign)));
        Assert.Equal(
            $"HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature={signature}",
            request.Headers.GetValues("Authorization").Single());

        using var json = JsonDocument.Parse(handler.Body);
        var root = json.RootElement;
        Assert.Equal("DoNotReply@exemplo.azurecomm.net", root.GetProperty("senderAddress").GetString());
        Assert.Equal("Assunto", root.GetProperty("content").GetProperty("subject").GetString());
        Assert.Equal("Texto", root.GetProperty("content").GetProperty("plainText").GetString());
        Assert.Equal("<p>Html</p>", root.GetProperty("content").GetProperty("html").GetString());
        Assert.Equal("dono@loja.invalid", root.GetProperty("recipients").GetProperty("to")[0].GetProperty("address").GetString());
    }

    [Fact]
    public async Task Recusa_do_provedor_vira_excecao()
    {
        var (sender, _, _) = CreateSender(HttpStatusCode.Unauthorized);

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            sender.SendAsync(new EmailMessage("dono@loja.invalid", "A", "B"), CancellationToken.None));
    }

    [Theory]
    [InlineData("endpoint=https://x.communication.azure.com/;accesskey=AAAA", true)]
    [InlineData("Endpoint=https://x.communication.azure.com/; AccessKey=AAAA", true)]
    [InlineData("endpoint=http://x.communication.azure.com/;accesskey=AAAA", false)]
    [InlineData("endpoint=https://x.communication.azure.com/", false)]
    [InlineData("endpoint=https://x.communication.azure.com/;accesskey=não-é-base64", false)]
    [InlineData("", false)]
    public void Connection_string_e_validada(string value, bool valid)
    {
        Assert.Equal(valid, AcsConnection.TryParse(value, out _));
    }

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value)).Build();

    private sealed class Env(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "PetGest.Api";
        public string ContentRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    [Fact]
    public void Configuracao_valida_passa()
    {
        EmailSettings.Validate(Config(), new Env("Production"));
        EmailSettings.Validate(Config(("Auth:RequireConfirmedEmail", "true")), new Env("Development"));
        EmailSettings.Validate(
            Config(("Email:Provider", "acs"), ("Email:AcsConnectionString", ConnectionString), ("Email:Sender", "a@b.azurecomm.net"),
                ("Auth:RequireConfirmedEmail", "true")),
            new Env("Production"));
    }

    [Theory]
    [InlineData("acs", "", "a@b.azurecomm.net", "false", "Email:AcsConnectionString")]
    [InlineData("acs", "conn", "", "false", "Email:Sender")]
    [InlineData("smtp", "", "", "false", "Email:Provider inválido")]
    [InlineData("log", "", "", "true", "Auth:RequireConfirmedEmail")]
    public void Configuracao_incompleta_impede_a_inicializacao(string provider, string connection, string sender, string requireConfirmed, string expected)
    {
        var config = Config(
            ("Email:Provider", provider),
            ("Email:AcsConnectionString", connection == "conn" ? ConnectionString : connection),
            ("Email:Sender", sender),
            ("Auth:RequireConfirmedEmail", requireConfirmed));

        var error = Assert.Throws<InvalidOperationException>(() => EmailSettings.Validate(config, new Env("Production")));
        Assert.Contains(expected, error.Message);
    }

    [Fact]
    public void Provedor_acs_e_o_registrado_quando_configurado()
    {
        using var factory = new ApiFactory(settings: new Dictionary<string, string?>
        {
            ["Email:Provider"] = "acs",
            ["Email:AcsConnectionString"] = ConnectionString,
            ["Email:Sender"] = "DoNotReply@exemplo.azurecomm.net",
        });
        using var scope = factory.Services.CreateScope();

        Assert.IsType<AcsEmailSender>(scope.ServiceProvider.GetRequiredService<IEmailSender>());
    }

    [Fact]
    public void Sem_configuracao_o_envio_e_so_log()
    {
        using var factory = new ApiFactory();
        using var scope = factory.Services.CreateScope();

        Assert.IsType<LogEmailSender>(scope.ServiceProvider.GetRequiredService<IEmailSender>());
    }
}
