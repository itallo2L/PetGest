using System.Net;

namespace PetGest.Api.Services;

// Textos definitivos dos e-mails em PT-BR (design D4 da T-22). Cada e-mail vai em texto
// puro e em HTML simples (sem imagens nem CSS externo, que leitores de e-mail bloqueiam).
public static class EmailTemplates
{
    public static EmailMessage Confirmation(string to, string link) => Build(
        to,
        "Confirme seu e-mail no PetGest",
        "Falta só confirmar o seu e-mail para terminar o cadastro no PetGest.",
        "Confirmar e-mail",
        link,
        "O link vale por 24 horas. Se você não criou uma conta no PetGest, ignore este e-mail.");

    public static EmailMessage PasswordReset(string to, string link) => Build(
        to,
        "Redefinir sua senha do PetGest",
        "Recebemos um pedido para redefinir a senha da sua conta no PetGest.",
        "Criar senha nova",
        link,
        "O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: sua senha continua a mesma.");

    private static EmailMessage Build(string to, string subject, string intro, string action, string link, string footer)
    {
        var text = $"{intro}\n\n{action}: {link}\n\n{footer}\n\n— PetGest";

        var safeLink = WebUtility.HtmlEncode(link);
        var html = $"""
            <!doctype html>
            <html lang="pt-BR">
            <body style="margin:0;padding:24px;background:#f4f7f7;font-family:Arial,Helvetica,sans-serif;color:#16272b">
              <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
                <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#108B91">PetGest</p>
                <p style="margin:16px 0;font-size:15px;line-height:1.5">{WebUtility.HtmlEncode(intro)}</p>
                <p style="margin:24px 0">
                  <a href="{safeLink}" style="display:inline-block;background:#108B91;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">{WebUtility.HtmlEncode(action)}</a>
                </p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#4b5f63">Se o botão não abrir, copie este endereço no navegador:<br><a href="{safeLink}" style="color:#108B91;word-break:break-all">{safeLink}</a></p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5f63">{WebUtility.HtmlEncode(footer)}</p>
              </div>
            </body>
            </html>
            """;

        return new EmailMessage(to, subject, text, html);
    }
}
