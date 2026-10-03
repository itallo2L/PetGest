using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data;

// Regras de gravação do isolamento por petshop (design D5 da T-13). O filtro global não
// cobre entidades anexadas à mão (Attach/Update/Remove), então aqui vale o valor
// ORIGINAL de PetshopId, não o que a entidade traz agora.
public class TenantWriteGuard : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Check(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Check(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private static void Check(DbContext? context)
    {
        if (context is not AppDbContext db)
        {
            return;
        }

        var petshopId = db.CurrentPetshopId;

        foreach (var entry in db.ChangeTracker.Entries())
        {
            switch (entry.Entity)
            {
                case Product product:
                    CheckProduct(entry.State, entry.Property(nameof(Product.PetshopId)), product, petshopId);
                    break;

                case Petshop when entry.State is EntityState.Modified or EntityState.Deleted:
                    if (petshopId is null || (Guid)entry.Property(nameof(Petshop.Id)).OriginalValue! != petshopId)
                    {
                        throw new TenantViolationException("Não é permitido alterar outro petshop.");
                    }
                    break;

                case Profile when entry.State == EntityState.Modified:
                    if (entry.Property(nameof(Profile.PetshopId)).IsModified)
                    {
                        throw new TenantViolationException("O vínculo do usuário com o petshop não pode ser alterado.");
                    }
                    break;
            }
        }
    }

    private static void CheckProduct(
        EntityState state,
        Microsoft.EntityFrameworkCore.ChangeTracking.PropertyEntry petshopProperty,
        Product product,
        Guid? petshopId)
    {
        switch (state)
        {
            case EntityState.Added:
                if (petshopId is null)
                {
                    throw new TenantViolationException("Sem petshop na requisição: produto não pode ser gravado.");
                }
                if (product.PetshopId == Guid.Empty)
                {
                    petshopProperty.CurrentValue = petshopId.Value;
                }
                else if (product.PetshopId != petshopId)
                {
                    throw new TenantViolationException("Não é permitido gravar produto em outro petshop.");
                }
                break;

            case EntityState.Modified or EntityState.Deleted:
                if (petshopId is null
                    || (Guid)petshopProperty.OriginalValue! != petshopId
                    || product.PetshopId != petshopId)
                {
                    throw new TenantViolationException("Não é permitido alterar, mover ou excluir produto de outro petshop.");
                }
                break;
        }
    }
}
