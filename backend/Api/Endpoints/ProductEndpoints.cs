using System.Text.RegularExpressions;
using PetGest.Api.Models;
using PetGest.Api.Services;

namespace PetGest.Api.Endpoints;

// /products (spec api-products). Todos protegidos pela política de fallback; o petshop
// vem só do token (filtros globais da T-13).
public static partial class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/products").WithTags("Products");

        group.MapGet("/", async (ProductService products, CancellationToken ct) =>
                Results.Ok(await products.ListAsync(ct)))
            .WithName("ListProducts")
            .Produces<List<ProductResponse>>();

        group.MapGet("/{id:guid}", async (Guid id, ProductService products, CancellationToken ct) =>
                (await products.GetAsync(id, ct)).ToResult(Results.Ok))
            .WithName("GetProduct")
            .Produces<ProductResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        // Busca do scanner (design D4): 200 com o produto da loja ou 404 — sem base externa.
        group.MapGet("/by-ean/{ean}", async (string ean, ProductService products, CancellationToken ct) =>
                EanFormat().IsMatch(ean)
                    ? (await products.FindByEanAsync(ean, ct)).ToResult(Results.Ok)
                    : ApiError.Validation(ProductErrorCodes.InvalidRequest, "Código de barras inválido.", "ean",
                        "O código de barras precisa ter de 8 a 14 dígitos.").ToResult())
            .WithName("FindProductByEan")
            .Produces<ProductResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/", async (ProductDraft draft, ProductService products, CancellationToken ct) =>
                (await products.CreateAsync(draft, ct)).ToResult(product => Results.Created($"/products/{product.Id}", product)))
            .WithName("CreateProduct")
            .Produces<ProductResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPut("/{id:guid}", async (Guid id, ProductUpdate update, ProductService products, CancellationToken ct) =>
                (await products.UpdateAsync(id, update, ct)).ToResult(Results.Ok))
            .WithName("UpdateProduct")
            .Produces<ProductResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapDelete("/{id:guid}", async (Guid id, ProductService products, CancellationToken ct) =>
                await products.DeleteAsync(id, ct) is { } error ? error.ToResult() : Results.NoContent())
            .WithName("DeleteProduct")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    [GeneratedRegex(ProductLimits.EanPattern)]
    private static partial Regex EanFormat();
}
