using System.ComponentModel.DataAnnotations;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Models;

// Contratos de /products (spec api-products; design D2 da T-15). Nenhum DTO de entrada
// tem petshop: o produto vai sempre para a loja do token.

public static class ProductLimits
{
    public const int NameMaxLength = 200;
    public const int CategoryMaxLength = 100;
    public const double MaxPrice = 99_999_999.99;
    public const string EanPattern = @"^\d{8,14}$";
}

// Rascunho de produto confirmado pelo usuário: o que o scanner, a foto e a voz produzem
// (PLANOMVP.md §4.3). Com origem `photo_ai`/`voice_ai`, o `DraftId` devolvido por
// /products/drafts liga o produto à resposta bruta da IA (design D4 da T-19).
public record ProductDraft(
    [property: Required, MaxLength(ProductLimits.NameMaxLength)] string Name,
    [property: Required, MaxLength(ProductLimits.CategoryMaxLength)] string Category,
    [property: Required, Range(0d, ProductLimits.MaxPrice)] decimal? Price,
    [property: RegularExpression(ProductLimits.EanPattern, ErrorMessage = "O código de barras precisa ter de 8 a 14 dígitos.")] string? Ean,
    [property: AllowedValues(ProductSourceExtensions.Barcode, ProductSourceExtensions.Manual,
        ProductSourceExtensions.PhotoAI, ProductSourceExtensions.VoiceAI, null,
        ErrorMessage = "A origem precisa ser 'barcode', 'manual', 'photo_ai' ou 'voice_ai'.")] string? Source = null,
    Guid? DraftId = null);

// Edição: substitui os campos e mantém a origem (como o update do V0, que não envia source).
public record ProductUpdate(
    [property: Required, MaxLength(ProductLimits.NameMaxLength)] string Name,
    [property: Required, MaxLength(ProductLimits.CategoryMaxLength)] string Category,
    [property: Required, Range(0d, ProductLimits.MaxPrice)] decimal? Price,
    [property: RegularExpression(ProductLimits.EanPattern, ErrorMessage = "O código de barras precisa ter de 8 a 14 dígitos.")] string? Ean);

public record ProductResponse(
    Guid Id,
    string Name,
    string Category,
    decimal Price,
    string? Ean,
    string Source,
    DateTimeOffset UpdatedAt)
{
    public static ProductResponse From(Product product) => new(
        product.Id, product.Name, product.Category, product.Price, product.Ean, product.Source.ToWire(), product.UpdatedAt);
}

// Produto que já tem o código de barras (extensão `product` do 409 ean_taken).
public record ProductOwner(Guid Id, string Name);
