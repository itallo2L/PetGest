namespace PetGest.Api.Data.Entities;

// Refresh token de uma sessão (design D4 da T-14). Só o hash SHA-256 é guardado; o
// valor em texto existe apenas na resposta ao cliente. Cada login/cadastro começa uma
// família; cada renovação revoga o token usado e cria o próximo na mesma família.
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public Guid FamilyId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedById { get; set; }
}
