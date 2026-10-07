using Microsoft.EntityFrameworkCore;
using PetGest.Api;
using PetGest.Api.Data;
using PetGest.Api.Endpoints;
using PetGest.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Usuário e petshop de cada requisição vêm das claims do token (design D4 da T-13).
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantContext, ClaimsTenantContext>();

// A string de conexão é lida da configuração final (depois do Build), para que
// variáveis de ambiente e os testes possam sobrescrevê-la, e recebe os padrões de
// conexão para o pooler do Supabase (DatabaseSetup, T-17). Convenção de nomes e
// TenantWriteGuard ficam no próprio AppDbContext (OnConfiguring).
builder.Services.AddDbContext<AppDbContext>((services, options) =>
    options.UseNpgsql(DatabaseSetup.WithDefaults(
        services.GetRequiredService<IConfiguration>().GetConnectionString("Default") ?? "")));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddPetGestAuth();
builder.Services.AddPetGestProxy();
builder.Services.AddPetGestAi();
builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddPetGestOpenApi();
// Validação embutida (DataAnnotations) dos DTOs de request — .NET 10.
builder.Services.AddValidation();
// Erros inesperados em ProblemDetails; TenantViolationException vira 403 (design D6 da T-15).
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<TenantViolationHandler>();

var app = builder.Build();

if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("Default")))
{
    throw new InvalidOperationException(
        "String de conexão ausente: configure 'ConnectionStrings:Default' " +
        "(em desenvolvimento, appsettings.Development.json; nos outros ambientes, a variável ConnectionStrings__Default).");
}

JwtSettings.Validate(app.Configuration);
EmailSettings.Validate(app.Configuration, app.Environment);

// Antes de tudo que lê o IP ou o esquema da requisição (rate limit, links).
app.UsePetGestProxy();
app.UseExceptionHandler();
app.UseCors();

// Swagger UI é middleware e fica antes da autenticação; o documento é endpoint e
// precisa de AllowAnonymous por causa da política de fallback (design D8 da T-14).
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "PetGest API"));
}

// A política de fallback vale também para requisições sem endpoint; sem este atalho,
// rota inexistente responderia 401 em vez de 404 (spec api-platform).
app.Use((context, next) =>
{
    if (context.GetEndpoint() is null)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return Task.CompletedTask;
    }
    return next(context);
});

// O limite de tentativas roda depois da autenticação: o de /auth conta por IP, e o da IA
// (T-19) conta por usuário, que só é conhecido depois de ler o token.
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthEndpoints();
app.MapAuthEndpoints();
app.MapProductEndpoints();
app.MapProductDraftEndpoints();
app.MapPetshopEndpoints();

app.Run();

public partial class Program;
