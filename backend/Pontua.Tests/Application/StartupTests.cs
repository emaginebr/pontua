using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Pontua.Application;
using Pontua.Domain.Interfaces;
using Pontua.DTO.Settings;
using Pontua.Infra.Interfaces.AppServices;

namespace Pontua.Tests.Application;

/// <summary>A composição (DI, opções, health check) não pode exigir <c>Google:ClientId</c>: o login Google é opcional.</summary>
public class StartupTests
{
    private static ServiceProvider BuildProvider(IDictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.ConfigurePontua(configuration, new TestHostEnvironment());
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
    }

    private static Dictionary<string, string?> BaseSettings() => new()
    {
        [$"ConnectionStrings:{Startup.CONNECTION_STRING_NAME}"] = "Host=localhost;Database=pontua_unit;Username=x;Password=x",
        ["Jwt:Secret"] = "unit-tests-only-secret-with-at-least-32-bytes",
        ["Jwt:Issuer"] = "pontua",
        ["Jwt:Audience"] = "pontua",
        ["App:FrontendBaseUrl"] = "http://localhost:5173"
    };

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ConfigurePontua_ShouldBuildAndResolveAuthServices_WhenGoogleClientIdIsNotConfigured(string? clientId)
    {
        var settings = BaseSettings();
        if (clientId != null)
            settings["Google:ClientId"] = clientId;

        using var provider = BuildProvider(settings);
        using var scope = provider.CreateScope();

        scope.ServiceProvider.GetRequiredService<IOptions<GoogleSettings>>().Value.IsEnabled.Should().BeFalse();
        scope.ServiceProvider.GetRequiredService<IAuthService>().Should().NotBeNull();
        scope.ServiceProvider.GetRequiredService<IGoogleTokenAppService>().Should().NotBeNull();
        provider.GetRequiredService<HealthCheckService>().Should().NotBeNull();
    }

    [Fact]
    public void ConfigurePontua_ShouldEnableGoogleLogin_WhenGoogleClientIdIsConfigured()
    {
        var settings = BaseSettings();
        settings["Google:ClientId"] = "pontua-test.apps.googleusercontent.com";

        using var provider = BuildProvider(settings);

        provider.GetRequiredService<IOptions<GoogleSettings>>().Value.IsEnabled.Should().BeTrue();
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("  \t ", false)]
    [InlineData("pontua-test.apps.googleusercontent.com", true)]
    public void GoogleSettings_IsEnabled_ShouldReflectClientId(string clientId, bool expected) =>
        new GoogleSettings { ClientId = clientId }.IsEnabled.Should().Be(expected);

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "Pontua.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
