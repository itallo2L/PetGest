using Microsoft.AspNetCore.Identity;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Services;

// Aceita o hash bcrypt das contas importadas do Supabase Auth e pede a regravação no
// formato padrão do Identity (T-11 D4; design D7 da T-14). O UserManager regrava
// sozinho quando recebe SuccessRehashNeeded, então o bcrypt some no primeiro login.
public class CompatPasswordHasher : PasswordHasher<AppUser>
{
    private static readonly string[] BcryptPrefixes = ["$2a$", "$2b$", "$2y$"];

    public static bool IsBcrypt(string? hash) =>
        hash is not null && BcryptPrefixes.Any(prefix => hash.StartsWith(prefix, StringComparison.Ordinal));

    public override PasswordVerificationResult VerifyHashedPassword(AppUser user, string hashedPassword, string providedPassword)
    {
        if (!IsBcrypt(hashedPassword))
        {
            return base.VerifyHashedPassword(user, hashedPassword, providedPassword);
        }

        try
        {
            return BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword)
                ? PasswordVerificationResult.SuccessRehashNeeded
                : PasswordVerificationResult.Failed;
        }
        // Hash mal formado faz o BCrypt lançar exceções variadas (SaltParseException,
        // IndexOutOfRangeException...): vira senha recusada, nunca erro no login.
        catch (Exception ex) when (ex is BCrypt.Net.SaltParseException or ArgumentException or IndexOutOfRangeException or FormatException)
        {
            return PasswordVerificationResult.Failed;
        }
    }
}
