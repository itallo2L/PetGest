using Microsoft.EntityFrameworkCore;

namespace PetGest.Api.Data;

// Sem entidades ainda: Petshop, Product e o vínculo usuário → petshop entram na T-13.
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}
