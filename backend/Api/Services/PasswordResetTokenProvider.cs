using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Services;

// Código de redefinição de senha com validade própria de 1 hora (design D3 da T-22).
//
// O provedor padrão do Identity (DataProtectorTokenProvider) tem um prazo só para todos os
// códigos — a confirmação de e-mail precisa de 24 horas — e lê o relógio do sistema por
// dentro, sem como testar a expiração. Este segue o mesmo formato (criação, usuário,
// finalidade e carimbo de segurança, protegidos pelo Data Protection), com a hora do
// TimeProvider. O carimbo de segurança muda quando a senha muda, então um código usado
// deixa de valer.
public class PasswordResetTokenProvider(IDataProtectionProvider dataProtection, TimeProvider time)
    : IUserTwoFactorTokenProvider<AppUser>
{
    public const string ProviderName = "PasswordReset";
    public static readonly TimeSpan Lifespan = TimeSpan.FromHours(1);

    private readonly IDataProtector _protector = dataProtection.CreateProtector("PetGest.PasswordReset");

    public async Task<string> GenerateAsync(string purpose, UserManager<AppUser> manager, AppUser user)
    {
        var stamp = manager.SupportsUserSecurityStamp ? await manager.GetSecurityStampAsync(user) : "";
        var payload = string.Join('\n',
            time.GetUtcNow().ToUnixTimeMilliseconds().ToString(System.Globalization.CultureInfo.InvariantCulture),
            await manager.GetUserIdAsync(user),
            purpose,
            stamp);
        return Convert.ToBase64String(_protector.Protect(Encoding.UTF8.GetBytes(payload)));
    }

    public async Task<bool> ValidateAsync(string purpose, string token, UserManager<AppUser> manager, AppUser user)
    {
        string[] parts;
        try
        {
            parts = Encoding.UTF8.GetString(_protector.Unprotect(Convert.FromBase64String(token))).Split('\n');
        }
        catch (Exception ex) when (ex is FormatException or System.Security.Cryptography.CryptographicException)
        {
            return false;
        }

        if (parts.Length != 4 || !long.TryParse(parts[0], out var createdMs))
        {
            return false;
        }

        var expires = DateTimeOffset.FromUnixTimeMilliseconds(createdMs) + Lifespan;
        if (expires < time.GetUtcNow()
            || parts[1] != await manager.GetUserIdAsync(user)
            || parts[2] != purpose)
        {
            return false;
        }

        var stamp = manager.SupportsUserSecurityStamp ? await manager.GetSecurityStampAsync(user) : "";
        return parts[3] == stamp;
    }

    // Só gera código quando pedido pela recuperação de senha, nunca como segundo fator.
    public Task<bool> CanGenerateTwoFactorTokenAsync(UserManager<AppUser> manager, AppUser user) => Task.FromResult(false);
}
