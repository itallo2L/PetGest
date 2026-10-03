namespace PetGest.Api.Data;

// Usuário e petshop da operação atual (design D4 da T-13). `null` significa sem
// usuário (anônimo) ou sem petshop — nesses casos nenhuma linha é lida nem gravada.
public interface ITenantContext
{
    Guid? UserId { get; }
    Guid? PetshopId { get; }
}
