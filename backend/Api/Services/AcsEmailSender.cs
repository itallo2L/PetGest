using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace PetGest.Api.Services;

// Endpoint e chave de acesso de uma connection string do Communication Services.
public record AcsConnection(Uri Endpoint, byte[] AccessKey)
{
    public static bool TryParse(string? connectionString, out AcsConnection? connection)
    {
        connection = null;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return false;
        }

        var parts = connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Split('=', 2))
            .Where(pair => pair.Length == 2)
            .ToDictionary(pair => pair[0].Trim().ToLowerInvariant(), pair => pair[1].Trim());

        if (!parts.TryGetValue("endpoint", out var endpoint)
            || !Uri.TryCreate(endpoint, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || !parts.TryGetValue("accesskey", out var key))
        {
            return false;
        }

        try
        {
            connection = new AcsConnection(uri, Convert.FromBase64String(key));
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

// Envio pelo Azure Communication Services Email (design D1 da T-22), pela API REST com
// autenticação HMAC — sem SDK, para ficar só com o HttpClient e ser testável com um
// HttpMessageHandler falso. Referência: "Sign an HTTP request" e "Email - Send"
// (api-version 2023-03-31) na documentação do Communication Services.
public class AcsEmailSender(HttpClient http, IOptions<EmailSettings> options, TimeProvider time) : IEmailSender
{
    public const string ApiVersion = "2023-03-31";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var settings = options.Value;
        if (!AcsConnection.TryParse(settings.AcsConnectionString, out var connection))
        {
            throw new InvalidOperationException("Email:AcsConnectionString ausente ou inválida.");
        }

        var body = JsonSerializer.SerializeToUtf8Bytes(new
        {
            senderAddress = settings.Sender,
            content = new { subject = message.Subject, plainText = message.Body, html = message.Html },
            recipients = new { to = new[] { new { address = message.To } } },
        }, Json);

        var uri = new Uri(connection!.Endpoint, $"/emails:send?api-version={ApiVersion}");
        using var request = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = new ByteArrayContent(body),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        Sign(request, body, connection.AccessKey, time.GetUtcNow());

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            // O corpo do erro do ACS traz o motivo (remetente não verificado, cota etc.),
            // sem dados do destinatário; o chamador registra e segue (o cadastro não falha).
            var detail = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException(
                $"Communication Services recusou o e-mail: {(int)response.StatusCode} {detail}", null, response.StatusCode);
        }
    }

    // Assinatura HMAC-SHA256 do Communication Services:
    // StringToSign = VERBO \n caminho+query \n data;host;hash-do-corpo
    public static void Sign(HttpRequestMessage request, byte[] body, byte[] accessKey, DateTimeOffset now)
    {
        var uri = request.RequestUri!;
        var date = now.UtcDateTime.ToString("R", CultureInfo.InvariantCulture);
        var contentHash = Convert.ToBase64String(SHA256.HashData(body));
        var stringToSign = $"{request.Method.Method}\n{uri.PathAndQuery}\n{date};{uri.Authority};{contentHash}";
        var signature = Convert.ToBase64String(HMACSHA256.HashData(accessKey, Encoding.UTF8.GetBytes(stringToSign)));

        request.Headers.Add("x-ms-date", date);
        request.Headers.Add("x-ms-content-sha256", contentHash);
        request.Headers.TryAddWithoutValidation(
            "Authorization", $"HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature={signature}");
    }
}
