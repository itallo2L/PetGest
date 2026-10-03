namespace PetGest.Api.Services;

public record EmailMessage(string To, string Subject, string Body);

// Envio de e-mail (design D6 da T-14). Nesta etapa só existe o envio de desenvolvimento;
// a T-22 troca pelo adaptador do provedor real no registro de DI.
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

// Grava a mensagem no log em vez de enviar — o link de confirmação aparece no console
// da API. Não usar em produção: o log conteria os códigos de confirmação.
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
