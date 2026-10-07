namespace PetGest.Api.Services;

// Texto puro sempre; HTML opcional (o provedor manda os dois e o leitor de e-mail escolhe).
public record EmailMessage(string To, string Subject, string Body, string? Html = null);

// Envio de e-mail (design D6 da T-14). O adaptador é escolhido por Email:Provider no
// registro de DI (design D1 da T-22): `log` em desenvolvimento, `acs` nos ambientes do Azure.
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

// Grava a mensagem no log em vez de enviar — o link aparece no console da API. Não usar
// em produção: o log conteria os códigos de confirmação e de redefinição de senha.
public class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        logger.LogInformation(
            "E-mail (envio de desenvolvimento, não enviado) para {To} — {Subject}\n{Body}",
            message.To, message.Subject, message.Body);
        return Task.CompletedTask;
    }
}
