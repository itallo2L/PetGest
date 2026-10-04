using PetGest.Api.Models;
using PetGest.Api.Services;

namespace PetGest.Api.Endpoints;

// /petshop (spec api-store). Protegidos pela política de fallback; a loja é a do token.
public static class PetshopEndpoints
{
    public static IEndpointRouteBuilder MapPetshopEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/petshop").WithTags("Petshop");

        group.MapGet("/", async (PetshopService petshops, CancellationToken ct) =>
                (await petshops.GetAsync(ct)).ToResult(Results.Ok))
            .WithName("GetPetshop")
            .Produces<PetshopResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPut("/", async (PetshopRequest request, PetshopService petshops, CancellationToken ct) =>
                (await petshops.UpdateAsync(request, ct)).ToResult(Results.Ok))
            .WithName("UpdatePetshop")
            .Produces<PetshopResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound);

        // Conta sem loja conclui o cadastro; depois, renovar a sessão para o token trazer a loja.
        group.MapPost("/", async (PetshopRequest request, PetshopService petshops, CancellationToken ct) =>
                (await petshops.CreateAsync(request, ct)).ToResult(petshop => Results.Created("/petshop", petshop)))
            .WithName("CreatePetshop")
            .WithDescription("Cria a loja da conta do token. A sessão precisa ser renovada (/auth/refresh) para o token trazer a loja.")
            .Produces<PetshopCreatedResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }
}
