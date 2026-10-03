using Microsoft.AspNetCore.Identity;

namespace PetGest.Api.Data.Entities;

// Conta do Identity (design D1 da T-14). Mesmo tipo de id de auth.users (Guid), para a
// T-18 importar as contas do Supabase mantendo os ids — e os vínculos em profiles.
public class AppUser : IdentityUser<Guid>
{
}
