namespace PetGest.Api.Data.Entities;

// Tabela `profiles` do V0: liga um usuário (mesmo Guid de auth.users e, depois, do
// Identity — T-11 D4) ao petshop dele. O vínculo nunca muda depois de criado.
public class Profile
{
    public Guid Id { get; set; }
    public Guid PetshopId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
