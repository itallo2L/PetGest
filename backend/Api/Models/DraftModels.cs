namespace PetGest.Api.Models;

// Contratos de /products/drafts (specs api-product-drafts; T-19 e T-20).

// Se foto e voz estão disponíveis (provedor de IA configurado).
public record DraftAvailabilityResponse(bool Photo, bool Voice);

// Rascunho sugerido pela IA para o formulário de cadastro: qualquer campo pode vir nulo.
// `DraftId` volta no POST /products para o produto salvo levar a resposta bruta da IA.
public record ProductSuggestionResponse(
    Guid DraftId,
    string Source,
    string? Name,
    string? Category,
    decimal? Price,
    string? Ean,
    string? Transcript);
