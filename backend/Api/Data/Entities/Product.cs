using System.Text.Json;

namespace PetGest.Api.Data.Entities;

// Tabela `products` do V0. PetshopId é preenchido pela API com o petshop do token
// (design D5 da T-13); CreatedAt/UpdatedAt são do banco (default + trigger).
public class Product
{
    public Guid Id { get; set; }
    public Guid PetshopId { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public decimal Price { get; set; }
    public string? Ean { get; set; }
    public ProductSource Source { get; set; }

    // Resposta bruta da IA (PLANOMVP.md §2.3); só existe para PhotoAI/VoiceAI.
    public JsonDocument? AiRawResponse { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
