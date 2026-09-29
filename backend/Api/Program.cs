using Microsoft.EntityFrameworkCore;
using PetGest.Api;
using PetGest.Api.Data;
using PetGest.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// A string de conexão é lida da configuração final (depois do Build), para que
// variáveis de ambiente e os testes possam sobrescrevê-la.
builder.Services.AddDbContext<AppDbContext>((services, options) =>
    options.UseNpgsql(services.GetRequiredService<IConfiguration>().GetConnectionString("Default")));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddOpenApi();

var app = builder.Build();

if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("Default")))
{
    throw new InvalidOperationException(
        "String de conexão ausente: configure 'ConnectionStrings:Default' " +
        "(em desenvolvimento, appsettings.Development.json; nos outros ambientes, a variável ConnectionStrings__Default).");
}

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "PetGest API"));
}

app.MapHealthEndpoints();

app.Run();

public partial class Program;
