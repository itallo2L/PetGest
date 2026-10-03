using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;

namespace PetGest.Api.Services;

// Regras de /auth (spec api-auth; design D4–D6 da T-14).
public class AuthService(
    AppDbContext db,
    UserManager<AppUser> users,
    SessionService sessions,
    IEmailSender emailSender,
    IOptions<AuthSettings> authOptions,
    ILogger<AuthService> logger)
{
    // Hash de uma senha qualquer, verificado quando o e-mail não existe, para o tempo de
    // resposta não revelar se há conta com aquele e-mail.
    private static readonly Lazy<string> DummyHash =
        new(() => new PasswordHasher<AppUser>().HashPassword(new AppUser(), Guid.NewGuid().ToString()));

    private AuthSettings Settings => authOptions.Value;

    // Conta + petshop + vínculo + sessão numa transação, sucessor de signup_petshop (D5).
    public async Task<AuthResult<Session>> SignupAsync(SignupRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        var user = new AppUser { UserName = email, Email = email };
        Session session;

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            IdentityResult created;
            try
            {
                created = await users.CreateAsync(user, request.Password);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Cadastro simultâneo com o mesmo e-mail: o índice único pegou.
                return AuthError.EmailTaken;
            }

            if (!created.Succeeded)
            {
                return ToSignupError(created);
            }

            var petshop = new Petshop
            {
                Name = request.PetshopName.Trim(),
                Email = request.PetshopEmail.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.PetshopPhone) ? null : request.PetshopPhone.Trim(),
            };
            db.Petshops.Add(petshop);
            await db.SaveChangesAsync(ct);

            // Gravado antes da sessão: a emissão lê o vínculo do banco para o petshop_id.
            db.Profiles.Add(new Profile { Id = user.Id, PetshopId = petshop.Id });
            await db.SaveChangesAsync(ct);

            session = await sessions.StartAsync(user, ct);
            await db.SaveChangesAsync(ct);

            await transaction.CommitAsync(ct);
        }

        // Depois do commit: falha no envio não desfaz o cadastro (spec).
        await SendConfirmationAsync(user, ct);
        return session;
    }

    public async Task<AuthResult<Session>> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            new PasswordHasher<AppUser>().VerifyHashedPassword(new AppUser(), DummyHash.Value, request.Password);
            return AuthError.InvalidCredentials;
        }

        // CheckPasswordAsync regrava o hash quando o hasher pede (bcrypt importado — D7).
        if (!await users.CheckPasswordAsync(user, request.Password))
        {
            return AuthError.InvalidCredentials;
        }

        // Conferido só depois da senha, para não revelar o estado da confirmação (D6).
        if (Settings.RequireConfirmedEmail && !user.EmailConfirmed)
        {
            return AuthError.EmailNotConfirmed;
        }

        var session = await sessions.StartAsync(user, ct);
        await db.SaveChangesAsync(ct);
        return session;
    }

    // Rotação com detecção de reuso (D4): o token usado é revogado e substituído; um
    // token já revogado que volta derruba a família inteira.
    public async Task<AuthResult<Session>> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var hash = SessionService.HashRefreshToken(request.RefreshToken);
        var now = sessions.Now;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var stored = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null || stored.ExpiresAt <= now)
        {
            return AuthError.InvalidRefreshToken;
        }

        // Reivindica o token de forma atômica: entre duas renovações simultâneas com o
        // mesmo token, só uma vence; a outra é tratada como reuso.
        var claimed = stored.RevokedAt is null && await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct) == 1;
        if (!claimed)
        {
            await RevokeFamilyAsync(stored.FamilyId, now, ct);
            await transaction.CommitAsync(ct);
            logger.LogWarning("Reuso de refresh token detectado; família {FamilyId} revogada.", stored.FamilyId);
            return AuthError.InvalidRefreshToken;
        }

        var user = await users.FindByIdAsync(stored.UserId.ToString());
        if (user is null)
        {
            return AuthError.InvalidRefreshToken;
        }
        if (Settings.RequireConfirmedEmail && !user.EmailConfirmed)
        {
            await RevokeFamilyAsync(stored.FamilyId, now, ct);
            await transaction.CommitAsync(ct);
            return AuthError.EmailNotConfirmed;
        }

        // ExecuteUpdate já gravou revoked_at; o tracker ainda tem o valor antigo.
        stored.RevokedAt = now;
        var session = await sessions.IssueAsync(user, stored.FamilyId, ct, created => stored.ReplacedById = created.Id);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return session;
    }

    // Sempre "sucesso": não revela se o token existia nem o estado de outras sessões.
    public async Task LogoutAsync(LogoutRequest request, CancellationToken ct)
    {
        var hash = SessionService.HashRefreshToken(request.RefreshToken);
        var familyId = await db.RefreshTokens
            .Where(t => t.TokenHash == hash)
            .Select(t => (Guid?)t.FamilyId)
            .SingleOrDefaultAsync(ct);
        if (familyId is not null)
        {
            await RevokeFamilyAsync(familyId.Value, sessions.Now, ct);
        }
    }

    public async Task<AuthError?> ConfirmEmailAsync(ConfirmEmailRequest request, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        if (user is null)
        {
            return AuthError.InvalidConfirmation;
        }

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Code));
        }
        catch (FormatException)
        {
            return AuthError.InvalidConfirmation;
        }

        var result = await users.ConfirmEmailAsync(user, token);
        return result.Succeeded ? null : AuthError.InvalidConfirmation;
    }

    public async Task<MeResponse?> GetMeAsync(Guid userId, Guid? petshopId)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        return user is null ? null : new MeResponse(user.Id, user.Email ?? "", user.EmailConfirmed, petshopId);
    }

    private Task<int> RevokeFamilyAsync(Guid familyId, DateTimeOffset now, CancellationToken ct) =>
        db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

    private async Task SendConfirmationAsync(AppUser user, CancellationToken ct)
    {
        try
        {
            var token = await users.GenerateEmailConfirmationTokenAsync(user);
            var code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var link = $"{Settings.FrontendBaseUrl.TrimEnd('/')}/confirmar-email?user={user.Id}&code={code}";
            await emailSender.SendAsync(new EmailMessage(
                user.Email!,
                "Confirme seu e-mail no PetGest",
                $"Para confirmar o e-mail da sua conta no PetGest, abra o link:\n{link}"), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Falha ao enviar o e-mail de confirmação para o usuário {UserId}.", user.Id);
        }
    }

    private static AuthError ToSignupError(IdentityResult result)
    {
        var codes = result.Errors.Select(e => e.Code).ToHashSet();
        if (codes.Contains(nameof(IdentityErrorDescriber.DuplicateEmail)) || codes.Contains(nameof(IdentityErrorDescriber.DuplicateUserName)))
        {
            return AuthError.EmailTaken;
        }

        var passwordErrors = result.Errors.Where(e => e.Code.StartsWith("Password", StringComparison.Ordinal)).ToArray();
        if (passwordErrors.Length > 0)
        {
            return new AuthError(StatusCodes.Status400BadRequest, AuthErrorCodes.WeakPassword,
                "A senha precisa ter pelo menos 6 caracteres.",
                new Dictionary<string, string[]> { ["password"] = passwordErrors.Select(e => e.Description).ToArray() });
        }

        return new AuthError(StatusCodes.Status400BadRequest, AuthErrorCodes.InvalidRequest, "Dados de cadastro inválidos.",
            new Dictionary<string, string[]> { ["email"] = result.Errors.Select(e => e.Description).ToArray() });
    }
}
