using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.JsonWebTokens;
using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// API em memória contra o banco petgest_tests (design D9 da T-14), com envio de e-mail
// capturado e relógio controlável.
public sealed partial class AuthApi : IDisposable
{
    public const string Password = "senha123";

    private readonly ApiFactory _factory;

    public AuthApi(
        DatabaseFixture fixture,
        IReadOnlyDictionary<string, string?>? settings = null,
        IEmailSender? emailSender = null)
    {
        Time = new FakeTimeProvider(DateTimeOffset.UtcNow);
        _factory = new ApiFactory(
            connectionString: fixture.ConnectionString,
            settings: settings,
            configureServices: services =>
            {
                services.RemoveAll<IEmailSender>();
                services.AddSingleton(emailSender ?? Emails);
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(Time);
            });
        Client = _factory.CreateClient();
    }

    public HttpClient Client { get; }
    public FakeTimeProvider Time { get; }
    public CapturingEmailSender Emails { get; } = new();

    public static string NewEmail() => $"dono-{Guid.NewGuid():N}@teste.invalid";

    public Task<HttpResponseMessage> PostAsync(string path, object body) => Client.PostAsJsonAsync(path, body);

    public async Task<SessionResponse> SignupAsync(string? email = null, string petshopName = "Pet Teste")
    {
        var response = await PostAsync("/auth/signup", new
        {
            email = email ?? NewEmail(),
            password = Password,
            petshopName,
            petshopEmail = "loja@teste.invalid",
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SessionResponse>())!;
    }

    public Task<HttpResponseMessage> LoginAsync(string email, string password = Password) =>
        PostAsync("/auth/login", new { email, password });

    public Task<HttpResponseMessage> RefreshAsync(string refreshToken) =>
        PostAsync("/auth/refresh", new { refreshToken });

    public async Task<HttpResponseMessage> MeAsync(string? accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/auth/me");
        if (accessToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        return await Client.SendAsync(request);
    }

    // Chamada autenticada com token e corpo JSON opcional (endpoints de dados, T-15).
    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string? accessToken, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (accessToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await Client.SendAsync(request);
    }

    public static async Task<T> ReadAsync<T>(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        Assert.Equal(expected, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    public static async Task<SessionResponse> ReadSessionAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SessionResponse>())!;
    }

    public static async Task<string?> ReadCodeAsync(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    public static JsonWebToken Decode(string accessToken) => new JsonWebTokenHandler().ReadJsonWebToken(accessToken);

    // Usuário e código do link de confirmação enviado para o e-mail.
    public (Guid UserId, string Code) ConfirmationFor(string email)
    {
        var message = Emails.Sent.Last(m => m.To == email);
        var match = ConfirmationLink().Match(message.Body);
        Assert.True(match.Success, "Link de confirmação não encontrado: " + message.Body);
        return (Guid.Parse(match.Groups["user"].Value), match.Groups["code"].Value);
    }

    public void Dispose()
    {
        Client.Dispose();
        _factory.Dispose();
    }

    [GeneratedRegex(@"/confirmar-email\?user=(?<user>[0-9a-f-]+)&code=(?<code>[A-Za-z0-9_-]+)")]
    private static partial Regex ConfirmationLink();
}

public class CapturingEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    public IReadOnlyCollection<EmailMessage> Sent => _sent;

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        _sent.Enqueue(message);
        return Task.CompletedTask;
    }
}

public class FailingEmailSender : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct) =>
        throw new InvalidOperationException("Provedor de e-mail fora do ar (teste).");
}
