using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using PetGest.Api.Data;
using PetGest.Api.Data.Entities;
using PetGest.Api.Services;

namespace PetGest.Api;

// Contas, sessão e proteção dos endpoints (design da T-14).
public static class AuthSetup
{
    public static IServiceCollection AddPetGestAuth(this IServiceCollection services)
    {
        // Seções lidas da configuração final, para variáveis de ambiente e testes
        // poderem sobrescrevê-las.
        services.AddOptions<JwtSettings>().BindConfiguration(JwtSettings.Section);
        services.AddOptions<AuthSettings>().BindConfiguration(AuthSettings.Section);
        services.TryAddSingleton(TimeProvider.System);

        // Identity "core": só UserManager, sem cookies nem papéis (design D1).
        services.AddIdentityCore<AppUser>(options =>
            {
                // Paridade com o V0 (MIN_PASSWORD_LENGTH = 6 no frontend, padrão do Supabase).
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 1;
                options.User.RequireUniqueEmail = true;
                // A exigência de e-mail confirmado é a configuração Auth:RequireConfirmedEmail (D6).
                options.SignIn.RequireConfirmedEmail = false;
                options.Lockout.AllowedForNewUsers = false;
            })
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        // Os códigos de confirmação de e-mail são assinados pelo Data Protection; a
        // persistência das chaves no App Service é da T-17.
        services.AddDataProtection();

        // Validade do código de confirmação de e-mail (spec api-auth: 24 horas).
        services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(24));

        // Senhas das contas importadas do V0 (bcrypt) — design D7.
        services.AddScoped<IPasswordHasher<AppUser>, CompatPasswordHasher>();

        services.AddScoped<SessionService>();
        services.AddScoped<AuthService>();
        // Envio de desenvolvimento (só log); a T-22 troca pelo provedor real.
        services.TryAddSingleton<IEmailSender, LogEmailSender>();

        // JWT de acesso (design D3): `sub` continua `sub` (sem mapeamento de claims) e
        // sem tolerância de relógio — expira aos 15 minutos, não aos 20.
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtSettings>, TimeProvider>((options, jwt, time) =>
            {
                options.MapInboundClaims = false;
                options.TimeProvider = time;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Value.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Value.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(jwt.Value.SigningKeyBytes),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    ValidateLifetime = true,
                    RequireExpirationTime = true,
                    ClockSkew = TimeSpan.Zero,
                    NameClaimType = "sub",
                };
            });

        // Protegido por padrão (design D8): endpoint público precisa de AllowAnonymous.
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        // Limite de tentativas em cadastro, login e confirmação, por IP de origem (D8).
        // Atrás do proxy do App Service, o IP certo depende de ForwardedHeaders (T-17).
        services.AddOptions<AuthRateLimitSettings>().BindConfiguration(AuthRateLimitSettings.Section);
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitSettings.PolicyName, context =>
            {
                var limits = context.RequestServices.GetRequiredService<IOptions<AuthRateLimitSettings>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = limits.PermitLimit,
                        Window = TimeSpan.FromSeconds(limits.WindowSeconds),
                        QueueLimit = 0,
                    });
            });
        });

        return services;
    }
}
