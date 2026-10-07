using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;
using PetGest.Api.Services;
using PetGest.Api.Services.Ai;

namespace PetGest.Api;

// Cadastro por foto e por voz (T-19, T-20): extrator de IA, rascunhos e limite de uso.
public static class AiSetup
{
    public static IServiceCollection AddPetGestAi(this IServiceCollection services)
    {
        services.AddOptions<AiSettings>().BindConfiguration(AiSettings.Section);
        services.AddOptions<AiRateLimitSettings>().BindConfiguration(AiRateLimitSettings.Section);
        services.AddMemoryCache();

        // Adaptador da OpenAI (design D1 da T-19); o tempo limite de cada chamada é do
        // próprio adaptador (Ai:OpenAI:TimeoutSeconds), não do HttpClient.
        services.AddHttpClient<IProductDraftExtractor, OpenAiProductDraftExtractor>(client =>
            client.Timeout = Timeout.InfiniteTimeSpan);
        services.AddScoped<ProductDraftService>();

        // Por usuário (claim `sub`), não por IP: o custo é de quem usa (design D5). Roda
        // depois da autenticação (ordem no Program.cs), quando o usuário já é conhecido.
        services.AddRateLimiter(options =>
            options.AddPolicy(AiRateLimitSettings.PolicyName, context =>
            {
                var limits = context.RequestServices.GetRequiredService<IOptions<AiRateLimitSettings>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst("sub")?.Value ?? "anonimo",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = limits.PermitLimit,
                        Window = TimeSpan.FromSeconds(limits.WindowSeconds),
                        QueueLimit = 0,
                    });
            }));

        return services;
    }
}
