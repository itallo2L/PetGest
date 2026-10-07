using Microsoft.EntityFrameworkCore;
using Npgsql;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;

namespace PetGest.Api.Services;

public static class ProductErrorCodes
{
    public const string ProductNotFound = "product_not_found";
    public const string EanTaken = "ean_taken";
    public const string PetshopRequired = "petshop_required";
    public const string InvalidRequest = "invalid_request";
}

// Catálogo da loja (spec api-products; design D1–D3 da T-15). Nada aqui filtra petshop à
// mão: os filtros globais da T-13 restringem toda consulta à loja do token, então produto
// inexistente e produto de outra loja caem no mesmo `null` → 404.
public class ProductService(AppDbContext db, ITenantContext tenant, ProductDraftService drafts)
{
    private static readonly ApiError NotFound =
        new(StatusCodes.Status404NotFound, ProductErrorCodes.ProductNotFound, "Produto não encontrado.");

    private static readonly ApiError PetshopRequired =
        new(StatusCodes.Status403Forbidden, ProductErrorCodes.PetshopRequired, "Conclua o cadastro da loja antes de cadastrar produtos.");

    public Task<List<ProductResponse>> ListAsync(CancellationToken ct) =>
        db.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .Select(p => ProductResponse.From(p))
            .ToListAsync(ct);

    public async Task<ApiResult<ProductResponse>> GetAsync(Guid id, CancellationToken ct) =>
        await db.Products.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct) is { } product
            ? ProductResponse.From(product)
            : NotFound;

    // Desfechos do scanner: o produto da loja com o código, ou 404. Sem base externa.
    public async Task<ApiResult<ProductResponse>> FindByEanAsync(string ean, CancellationToken ct) =>
        await db.Products.AsNoTracking().SingleOrDefaultAsync(p => p.Ean == ean, ct) is { } product
            ? ProductResponse.From(product)
            : NotFound;

    public async Task<ApiResult<ProductResponse>> CreateAsync(ProductDraft draft, CancellationToken ct)
    {
        if (tenant.PetshopId is null)
        {
            return PetshopRequired;
        }
        if (ValidatePrice(draft.Price!.Value) is { } priceError)
        {
            return priceError;
        }

        var ean = NormalizeEan(draft.Ean);
        if (await FindOwnerAsync(ean, exceptId: null, ct) is { } owner)
        {
            return EanTaken(ean!, owner);
        }

        var source = draft.Source is null ? ProductSource.Manual : ProductSourceExtensions.FromWire(draft.Source);

        // PetshopId fica vazio: o TenantWriteGuard preenche com o petshop do token. A
        // resposta bruta da IA só vem de um rascunho desta loja e da mesma origem; sem ele
        // (expirado, de outra loja), o produto é salvo sem ela (design D4 da T-19).
        var product = new Product
        {
            Name = draft.Name.Trim(),
            Category = draft.Category.Trim(),
            Price = draft.Price.Value,
            Ean = ean,
            Source = source,
            AiRawResponse = source is ProductSource.PhotoAI or ProductSource.VoiceAI ? drafts.TakeRaw(draft.DraftId, source) : null,
        };
        db.Products.Add(product);

        return await SaveAsync(product, ean, ct);
    }

    public async Task<ApiResult<ProductResponse>> UpdateAsync(Guid id, ProductUpdate update, CancellationToken ct)
    {
        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }
        if (ValidatePrice(update.Price!.Value) is { } priceError)
        {
            return priceError;
        }

        var ean = NormalizeEan(update.Ean);
        if (await FindOwnerAsync(ean, exceptId: id, ct) is { } owner)
        {
            return EanTaken(ean!, owner);
        }

        product.Name = update.Name.Trim();
        product.Category = update.Category.Trim();
        product.Price = update.Price.Value;
        product.Ean = ean;

        return await SaveAsync(product, ean, ct);
    }

    // Carrega pelo filtro e remove, para passar pelo TenantWriteGuard (não ExecuteDelete).
    public async Task<ApiError?> DeleteAsync(Guid id, CancellationToken ct)
    {
        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return NotFound;
        }

        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);
        return null;
    }

    private async Task<ApiResult<ProductResponse>> SaveAsync(Product product, string? ean, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return ProductResponse.From(product);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Dois cadastros simultâneos com o mesmo código passaram pela verificação;
            // o índice único pegou o segundo (design D3).
            var owner = await FindOwnerAsync(ean, exceptId: product.Id, ct);
            if (owner is null)
            {
                throw;
            }
            return EanTaken(ean!, owner);
        }
    }

    private Task<ProductOwner?> FindOwnerAsync(string? ean, Guid? exceptId, CancellationToken ct) =>
        ean is null
            ? Task.FromResult<ProductOwner?>(null)
            : db.Products
                .AsNoTracking()
                .Where(p => p.Ean == ean && p.Id != exceptId)
                .Select(p => new ProductOwner(p.Id, p.Name))
                .SingleOrDefaultAsync(ct);

    private static string? NormalizeEan(string? ean) => string.IsNullOrWhiteSpace(ean) ? null : ean;

    // numeric(10,2): mais de duas casas seria arredondado em silêncio pelo banco.
    private static ApiError? ValidatePrice(decimal price) =>
        decimal.Round(price, 2) == price
            ? null
            : ApiError.Validation(ProductErrorCodes.InvalidRequest, "Preço inválido.", "price",
                "O preço pode ter no máximo duas casas decimais.");

    private static ApiError EanTaken(string ean, ProductOwner owner) => new(
        StatusCodes.Status409Conflict,
        ProductErrorCodes.EanTaken,
        $"O código de barras {ean} já pertence a {owner.Name}.",
        Extensions: new Dictionary<string, object?> { ["product"] = owner });
}
