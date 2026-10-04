using System.ComponentModel.DataAnnotations;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Models;

// Contratos de /petshop (spec api-store; design D5 da T-15). Sem identificador de loja
// no corpo: a loja é sempre a do token.
public record PetshopRequest(
    [property: Required, MaxLength(200)] string Name,
    [property: Required, EmailAddress, MaxLength(256)] string Email,
    [property: MaxLength(40)] string? Phone);

public record PetshopResponse(Guid Id, string Name, string Email, string? Phone)
{
    public static PetshopResponse From(Petshop petshop) => new(petshop.Id, petshop.Name, petshop.Email, petshop.Phone);
}

// Resposta da criação da loja: o token da chamada ainda não tem petshop_id — o cliente
// renova a sessão (/auth/refresh) para o token seguinte trazer a loja nova.
public record PetshopCreatedResponse(Guid Id, string Name, string Email, string? Phone, bool SessionRenewalRequired);
