namespace PetGest.Api.Data.Entities;

// Tabela `petshops` do V0 (supabase/schema.sql): uma loja por conta.
public class Petshop
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
