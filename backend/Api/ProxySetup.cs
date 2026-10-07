using Microsoft.AspNetCore.HttpOverrides;

namespace PetGest.Api;

// Atrás do proxy do App Service (design D2 da T-17), o IP da conexão é o do proxy: sem
// isto, o limite de tentativas de /auth contaria todos os clientes como um só. Ligado só
// por configuração (ForwardedHeaders:Enabled), porque fora de um proxy confiável o
// cabeçalho X-Forwarded-For vem do próprio cliente e poderia ser forjado.
public static class ProxySetup
{
    public const string EnabledKey = "ForwardedHeaders:Enabled";

    public static IServiceCollection AddPetGestProxy(this IServiceCollection services)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            // Os IPs do proxy do App Service não são fixos: confia em qualquer origem, mas
            // só na última entrada da lista, que é a que o próprio proxy acrescentou. As
            // anteriores podem ter sido escritas pelo cliente.
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            options.ForwardLimit = 1;
        });
        return services;
    }

    public static WebApplication UsePetGestProxy(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>(EnabledKey))
        {
            app.UseForwardedHeaders();
        }
        return app;
    }
}
