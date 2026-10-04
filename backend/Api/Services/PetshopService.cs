using Microsoft.EntityFrameworkCore;
using Npgsql;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;
using PetGest.Api.Models;

namespace PetGest.Api.Services;

public static class PetshopErrorCodes
{
    public const string PetshopNotFound = "petshop_not_found";
    public const string PetshopExists = "petshop_exists";
}

// Dados da loja (spec api-store; design D5 da T-15). Os filtros globais da T-13 já
// restringem Petshops à loja do token e Profiles ao usuário do token.
public class PetshopService(AppDbContext db, ITenantContext tenant)
{
    private static readonly ApiError NotFound =
        new(StatusCodes.Status404NotFound, PetshopErrorCodes.PetshopNotFound, "Esta conta ainda não tem loja cadastrada.");

    private static readonly ApiError Exists =
        new(StatusCodes.Status409Conflict, PetshopErrorCodes.PetshopExists, "Esta conta já tem uma loja.");

    public async Task<ApiResult<PetshopResponse>> GetAsync(CancellationToken ct) =>
        await db.Petshops.AsNoTracking().SingleOrDefaultAsync(ct) is { } petshop
            ? PetshopResponse.From(petshop)
            : NotFound;

    // Só a loja do token: o corpo nem tem identificador de loja.
    public async Task<ApiResult<PetshopResponse>> UpdateAsync(PetshopRequest request, CancellationToken ct)
    {
        var petshop = await db.Petshops.SingleOrDefaultAsync(ct);
        if (petshop is null)
        {
            return NotFound;
        }

        Apply(petshop, request);
        await db.SaveChangesAsync(ct);
        return PetshopResponse.From(petshop);
    }

    // Conta autenticada sem loja conclui o cadastro (paridade com signup_petshop do V0).
    public async Task<ApiResult<PetshopCreatedResponse>> CreateAsync(PetshopRequest request, CancellationToken ct)
    {
        var userId = tenant.UserId!.Value; // a política de fallback garante usuário autenticado
        if (await db.Profiles.AnyAsync(ct))
        {
            return Exists;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var petshop = new Petshop { Name = "", Email = "" };
        Apply(petshop, request);
        db.Petshops.Add(petshop);
        await db.SaveChangesAsync(ct);

        db.Profiles.Add(new Profile { Id = userId, PetshopId = petshop.Id });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Duas chamadas simultâneas: a PK de profiles pegou a segunda.
            return Exists;
        }

        await transaction.CommitAsync(ct);
        return new PetshopCreatedResponse(petshop.Id, petshop.Name, petshop.Email, petshop.Phone, SessionRenewalRequired: true);
    }

    private static void Apply(Petshop petshop, PetshopRequest request)
    {
        petshop.Name = request.Name.Trim();
        petshop.Email = request.Email.Trim();
        petshop.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
    }
}
