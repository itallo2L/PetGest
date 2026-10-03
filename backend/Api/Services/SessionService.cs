using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Services;

public record Session(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

// Emissão da sessão: JWT de 15 minutos + refresh token opaco de 30 dias (design D3/D4
// da T-14). Só adiciona o refresh token ao contexto; quem chama grava (SaveChanges),
// para a emissão entrar na mesma transação do cadastro/login/renovação.
public class SessionService(AppDbContext db, IOptions<JwtSettings> jwtOptions, TimeProvider time)
{
    public const string PetshopIdClaim = ClaimsTenantContext.PetshopIdClaim;

    private static readonly JsonWebTokenHandler TokenHandler = new();

    public DateTimeOffset Now => time.GetUtcNow();

    // Começa uma família nova (cadastro e login).
    public Task<Session> StartAsync(AppUser user, CancellationToken ct) => IssueAsync(user, Guid.NewGuid(), ct);

    // Emite a próxima sessão de uma família (renovação) e devolve o token criado, para o
    // token anterior apontar para ele (replaced_by_id).
    public async Task<Session> IssueAsync(AppUser user, Guid familyId, CancellationToken ct, Action<RefreshToken>? onCreated = null)
    {
        var now = Now;
        var petshopId = await FindPetshopIdAsync(user.Id, ct);

        var accessExpiresAt = now + JwtSettings.AccessTokenLifetime;
        var accessToken = CreateAccessToken(user, petshopId, now, accessExpiresAt);

        var refreshToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = HashRefreshToken(refreshToken),
            FamilyId = familyId,
            CreatedAt = now,
            ExpiresAt = now + JwtSettings.RefreshTokenLifetime,
        };
        db.RefreshTokens.Add(entity);
        onCreated?.Invoke(entity);

        return new Session(accessToken, accessExpiresAt, refreshToken, entity.ExpiresAt);
    }

    // O valor tem 256 bits aleatórios: SHA-256 sem sal não é reversível na prática e
    // permite buscar o token por igualdade.
    public static string HashRefreshToken(string refreshToken) =>
        WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

    // A emissão roda numa requisição anônima, em que o filtro de Profile esconderia o
    // vínculo: leitura sem filtro, restrita explicitamente ao usuário (design D3).
    private Task<Guid?> FindPetshopIdAsync(Guid userId, CancellationToken ct) =>
        db.Profiles
            .IgnoreQueryFilters()
            .Where(p => p.Id == userId)
            .Select(p => (Guid?)p.PetshopId)
            .SingleOrDefaultAsync(ct);

    private string CreateAccessToken(AppUser user, Guid? petshopId, DateTimeOffset now, DateTimeOffset expiresAt)
    {
        var jwt = jwtOptions.Value;
        var claims = new Dictionary<string, object>
        {
            [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
            [JwtRegisteredClaimNames.Email] = user.Email ?? "",
            [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString(),
        };
        if (petshopId is not null)
        {
            claims[PetshopIdClaim] = petshopId.Value.ToString();
        }

        return TokenHandler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            Claims = claims,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(jwt.SigningKeyBytes), SecurityAlgorithms.HmacSha256),
        });
    }
}
