using PetGest.Api.Models;
using PetGest.Api.Services;
using PetGest.Api.Services.Ai;

namespace PetGest.Api.Endpoints;

// /products/drafts (specs api-product-drafts; T-19 foto, T-20 voz). Protegidos como o resto
// da API; a extração tem limite por usuário para conter o custo da IA (design D5 da T-19).
// Sem antiforgery: a API autentica por Bearer, não por cookie, então não há CSRF a evitar.
public static class ProductDraftEndpoints
{
    public static IEndpointRouteBuilder MapProductDraftEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/products/drafts").WithTags("Product drafts");

        group.MapGet("/availability", (ProductDraftService drafts) => Results.Ok(drafts.Availability()))
            .WithName("GetDraftAvailability")
            .Produces<DraftAvailabilityResponse>();

        group.MapPost("/photo", async (IFormFile? image, ProductDraftService drafts, CancellationToken ct) =>
                (await drafts.FromPhotoAsync(image, ct)).ToResult(Results.Ok))
            .DisableAntiforgery()
            .RequireRateLimiting(AiRateLimitSettings.PolicyName)
            .Accepts<IFormFile>("multipart/form-data")
            .WithName("CreateDraftFromPhoto")
            .Produces<ProductSuggestionResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapPost("/voice", async (IFormFile? audio, ProductDraftService drafts, CancellationToken ct) =>
                (await drafts.FromVoiceAsync(audio, ct)).ToResult(Results.Ok))
            .DisableAntiforgery()
            .RequireRateLimiting(AiRateLimitSettings.PolicyName)
            .Accepts<IFormFile>("multipart/form-data")
            .WithName("CreateDraftFromVoice")
            .Produces<ProductSuggestionResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }
}
