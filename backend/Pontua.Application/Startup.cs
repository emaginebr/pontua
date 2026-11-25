using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Pontua.Application.Json;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.DTO.Settings;
using Pontua.Infra.AppServices;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.AppServices;
using Pontua.Infra.Interfaces.Repository;
using Pontua.Infra.Repository;

namespace Pontua.Application;

/// <summary>Composição centralizada da aplicação (skill dotnet-architecture, Princípio VI).</summary>
public static class Startup
{
    public const int MIN_JWT_SECRET_BYTES = 32;
    public const string CORS_POLICY = "PontuaCors";
    public const string CONNECTION_STRING_NAME = "PontuaContext";
    public const string DATABASE_SECTION = "Database";

    public static IServiceCollection ConfigurePontua(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        // Settings (IOptions)
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<GoogleSettings>(configuration.GetSection("Google"));
        services.Configure<AppSettings>(configuration.GetSection("App"));
        services.Configure<CorsSettings>(configuration.GetSection("Cors"));
        services.Configure<DatabaseSettings>(configuration.GetSection(DATABASE_SECTION));

        // DbContext e transação
        var connectionString = configuration.GetConnectionString(CONNECTION_STRING_NAME) ?? string.Empty;
        services.AddDbContext<PontuaContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<INsrAllocator, NsrAllocator>();

        // Repositories
        services.AddScoped<IUserRepository<User>, UserRepository>();
        services.AddScoped<ICompanyRepository<Company>, CompanyRepository>();
        services.AddScoped<IPositionRepository<Position>, PositionRepository>();
        services.AddScoped<IMemberRepository<Member, MemberPosition, ManagerPosition>, MemberRepository>();
        services.AddScoped<IScheduleRepository<Schedule>, ScheduleRepository>();
        services.AddScoped<IInvitationRepository<Invitation>, InvitationRepository>();
        services.AddScoped<IPunchRepository<Punch, PunchStatusChange>, PunchRepository>();

        // AppServices
        services.AddScoped<IGoogleTokenAppService, GoogleTokenAppService>();

        // Validators (FluentValidation) do Domain
        services.AddValidatorsFromAssembly(typeof(DateRangeResolver).Assembly, ServiceLifetime.Scoped);

        // Domain Services transversais
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<ICompanyClock, CompanyClock>();
        services.AddSingleton<IScheduleResolver, ScheduleResolver>();
        services.AddScoped<ICompanyAccessPolicy, CompanyAccessPolicy>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

        // Domain Services das histórias (Auth, Company, Position, Member, Invitation, Punch, Approval, Summary)
        // são registrados aqui conforme forem implementados.
        services.AddScoped<IAuthService, AuthService>();            // US1
        services.AddScoped<ICompanyService, CompanyService>();      // US1
        services.AddScoped<IPositionService, PositionService>();    // US2
        services.AddScoped<IInvitationService, InvitationService>(); // US3
        services.AddScoped<IMemberService, MemberService>();        // US3 (consultas) e US7 (administração)
        services.AddScoped<IPunchService, PunchService>();          // US4 e US5 (manual, cancelamento)
        services.AddScoped<ISummaryService, SummaryService>();      // US4
        services.AddScoped<IApprovalService, ApprovalService>();    // US6

        // JSON da API: camelCase, enums como string camelCase, horários HH:mm.
        services.Configure<JsonOptions>(options => options.JsonSerializerOptions.ConfigurePontuaJson());

        services.AddPontuaAuthentication(configuration);
        services.AddPontuaCors(configuration, environment);

        // GET /health inclui a conexão com o PostgreSQL.
        services.AddHealthChecks().AddNpgSql(_ => connectionString, name: "postgresql", tags: new[] { "db" });

        return services;
    }

    /// <summary>
    /// Aplica as migrações pendentes do <see cref="PontuaContext"/> somente quando <c>Database:MigrateOnStartup</c>
    /// é <c>true</c> (homologação/Docker). Nos demais ambientes não faz nada.
    /// </summary>
    public static async Task MigratePontuaDatabaseIfEnabledAsync(
        this IServiceProvider serviceProvider,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        var settings = configuration.GetSection(DATABASE_SECTION).Get<DatabaseSettings>() ?? new DatabaseSettings();
        if (!settings.MigrateOnStartup)
            return;

        using var scope = serviceProvider.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(Startup).FullName!);
        var context = scope.ServiceProvider.GetRequiredService<PontuaContext>();

        var pending = (await context.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
        if (pending.Count == 0)
        {
            logger.LogInformation("Database:MigrateOnStartup ativo: nenhuma migração pendente.");
            return;
        }

        logger.LogInformation("Database:MigrateOnStartup ativo: aplicando {Count} migração(ões): {Migrations}",
            pending.Count, string.Join(", ", pending));
        await context.Database.MigrateAsync(cancellationToken);
    }

    /// <summary>JWT Bearer HMAC-SHA256; a API não inicia sem <c>Jwt:Secret</c> com pelo menos 32 bytes.</summary>
    private static void AddPontuaAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
        EnsureJwtSecret(jwt.Secret);

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                    ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = "name"
                };
            });
        services.AddAuthorization();
    }

    public static void EnsureJwtSecret(string? secret)
    {
        if (string.IsNullOrEmpty(secret) || Encoding.UTF8.GetByteCount(secret) < MIN_JWT_SECRET_BYTES)
            throw new InvalidOperationException(
                $"Jwt:Secret deve ter pelo menos {MIN_JWT_SECRET_BYTES} bytes. Defina a variável de ambiente Jwt__Secret.");
    }

    /// <summary>CORS: qualquer origem só em Development; nos demais ambientes, apenas <c>Cors:AllowedOrigins</c>.</summary>
    private static void AddPontuaCors(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddCors(options =>
        {
            options.AddPolicy(CORS_POLICY, policy =>
            {
                if (environment.IsDevelopment())
                {
                    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
                    return;
                }

                var cors = configuration.GetSection("Cors").Get<CorsSettings>() ?? new CorsSettings();
                var origins = cors.AllowedOrigins.Where(o => !string.IsNullOrWhiteSpace(o)).ToArray();
                if (origins.Length > 0)
                    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
            });
        });
    }
}
