using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using Pontua.Application;
using Pontua.DTO;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigurePontua(builder.Configuration, builder.Environment);

// Validação de entrada fica com o FluentValidation (mensagens em português, R-15): sem [Required] implícito
// para propriedades string não anuláveis dos DTOs.
builder.Services.AddControllers(options => options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true)
    .ConfigureApiBehaviorOptions(options =>
    {
        // Erros de model binding (JSON malformado, tipos inválidos) também usam o envelope { sucesso, mensagem, erros }.
        options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(new ErrorResult
        {
            Sucesso = false,
            Mensagem = "Requisição inválida.",
            Erros = context.ModelState
                .Where(entry => entry.Value?.Errors.Count > 0)
                .SelectMany(entry => entry.Value!.Errors.Select(error => new ErrorItem
                {
                    Campo = ToCamelCasePath(entry.Key),
                    Mensagem = string.IsNullOrWhiteSpace(error.ErrorMessage)
                        ? $"Valor inválido em '{ToCamelCasePath(entry.Key)}'."
                        : error.ErrorMessage
                }))
                .ToList()
        });
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Pontua API", Version = "v1" });
    var xmlFile = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    if (File.Exists(xmlFile))
        options.IncludeXmlComments(xmlFile);

    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Informe o token JWT (sem o prefixo Bearer).",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { { scheme, Array.Empty<string>() } });
});

var app = builder.Build();

// Homologação (Docker) aplica as migrações no startup; Development e Production não (Database:MigrateOnStartup).
await app.Services.MigratePontuaDatabaseIfEnabledAsync(app.Configuration);

// Swagger em Development e em homologação (Docker), que precisa ser testável sem o frontend.
var isHomolog = app.Environment.IsEnvironment(DOCKER_ENVIRONMENT);
if (app.Environment.IsDevelopment() || isHomolog)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Em homologação o container só expõe HTTP (8080); o TLS fica fora da API.
if (!isHomolog)
    app.UseHttpsRedirection();
app.UseCors(Startup.CORS_POLICY);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

static string ToCamelCasePath(string key) =>
    string.Join('.', key.TrimStart('$', '.').Split('.').Select(segment => JsonNamingPolicy.CamelCase.ConvertName(segment)));

public partial class Program
{
    private const string DOCKER_ENVIRONMENT = "Docker";
}
