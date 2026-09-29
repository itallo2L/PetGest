using System.Text.RegularExpressions;

namespace PetGest.Api;

// CORS restrito às origens do frontend (design D6 da T-12). As listas vêm da seção
// "Cors" da configuração para cada ambiente poder sobrescrever sem mudar código.
public static class CorsSetup
{
    public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Cors");
        var origins = section.GetSection("AllowedOrigins").Get<string[]>() ?? [];
        var patterns = (section.GetSection("AllowedOriginPatterns").Get<string[]>() ?? [])
            .Select(p => new Regex(p, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)))
            .ToArray();

        services.AddCors(options => options.AddDefaultPolicy(policy => policy
            .SetIsOriginAllowed(origin =>
                origins.Contains(origin, StringComparer.OrdinalIgnoreCase) || patterns.Any(r => r.IsMatch(origin)))
            .AllowAnyHeader()
            .AllowAnyMethod()));

        return services;
    }
}
