using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;

namespace PetGest.Api;

// Documento OpenAPI com o esquema Bearer (design D8 da T-14): o Swagger UI ganha o botão
// Authorize e as operações protegidas ficam marcadas — a T-16 gera o cliente sabendo
// quais rotas exigem token.
public static class OpenApiSetup
{
    private const string SchemeName = "Bearer";

    public static IServiceCollection AddPetGestOpenApi(this IServiceCollection services) =>
        services.AddOpenApi(options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Components ??= new OpenApiComponents();
                document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
                document.Components.SecuritySchemes[SchemeName] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description = "Token de acesso devolvido por /auth/signup, /auth/login ou /auth/refresh.",
                };
                return Task.CompletedTask;
            });

            // Toda operação sem AllowAnonymous exige o token (política de fallback).
            options.AddOperationTransformer((operation, context, _) =>
            {
                var metadata = context.Description.ActionDescriptor.EndpointMetadata;
                if (!metadata.OfType<IAllowAnonymous>().Any())
                {
                    operation.Security ??= [];
                    operation.Security.Add(new OpenApiSecurityRequirement
                    {
                        [new OpenApiSecuritySchemeReference(SchemeName, context.Document)] = [],
                    });
                }
                return Task.CompletedTask;
            });
        });
}
