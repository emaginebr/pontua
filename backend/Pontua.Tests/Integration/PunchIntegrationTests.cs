using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Pontua.Application;
using Pontua.Domain.Enums;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.DTO.Companies;
using Pontua.DTO.Punches;
using Pontua.Infra.Context;

namespace Pontua.Tests.Integration;

/// <summary>
/// Integração contra PostgreSQL real (<c>PONTUA_TEST_DB</c>): NSR sem lacunas sob concorrência (R-05), trigger de
/// imutabilidade (R-04) e idempotência offline sob reenvio concorrente (R-10). Cada teste cria a sua própria empresa;
/// as marcações não podem ser apagadas (trigger), então use um banco descartável.
/// </summary>
[Trait("Category", "Integration")]
public sealed class PunchIntegrationTests : IAsyncLifetime
{
    private ServiceProvider? _provider;

    public async Task InitializeAsync()
    {
        var connectionString = IntegrationFactAttribute.ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString))
            return; // testes marcados como ignorados pelo IntegrationFactAttribute

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"ConnectionStrings:{Startup.CONNECTION_STRING_NAME}"] = connectionString,
                ["Jwt:Secret"] = "integration-tests-only-secret-with-at-least-32-bytes",
                ["Jwt:Issuer"] = "pontua",
                ["Jwt:Audience"] = "pontua",
                ["App:FrontendBaseUrl"] = "http://localhost:5173"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.ConfigurePontua(configuration, new TestHostEnvironment());
        _provider = services.BuildServiceProvider();

        using var scope = _provider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<PontuaContext>().Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_provider != null)
            await _provider.DisposeAsync();
    }

    [IntegrationFact]
    public async Task PunchAsync_ShouldGenerateNsr1To50WithoutGaps_When50MembersPunchConcurrently()
    {
        var (companyId, ownerUserId) = await CreateCompanyAsync();
        var userIds = new List<long> { ownerUserId };
        userIds.AddRange(await AddMembersAsync(companyId, 49));

        var punches = await Task.WhenAll(userIds.Select(userId => Task.Run(async () =>
        {
            using var scope = _provider!.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<IPunchService>().PunchAsync(companyId, userId);
        })));

        punches.Select(p => p.Nsr).Order().Should().Equal(Enumerable.Range(1, 50).Select(n => (long)n));

        using var check = _provider!.CreateScope();
        var context = check.ServiceProvider.GetRequiredService<PontuaContext>();
        var stored = await context.Punches.Where(p => p.CompanyId == companyId).Select(p => p.Nsr).OrderBy(n => n).ToListAsync();
        stored.Should().Equal(Enumerable.Range(1, 50).Select(n => (long)n));
        (await context.Companies.Where(c => c.CompanyId == companyId).Select(c => c.LastNsr).SingleAsync()).Should().Be(50);
        (await context.PunchStatusChanges.CountAsync(c =>
            context.Punches.Any(p => p.PunchId == c.PunchId && p.CompanyId == companyId))).Should().Be(50,
            "cada marcação ganha a linha inicial do histórico na mesma transação");
    }

    [IntegrationFact]
    public async Task Trigger_ShouldRejectUpdateOfPunchedAtAndDelete_ButAllowStatusUpdate()
    {
        var (companyId, ownerUserId) = await CreateCompanyAsync();
        using var scope = _provider!.CreateScope();
        var punch = await scope.ServiceProvider.GetRequiredService<IPunchService>().PunchAsync(companyId, ownerUserId);
        var context = scope.ServiceProvider.GetRequiredService<PontuaContext>();

        var update = () => context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE punches SET punched_at = punched_at - interval '1 hour' WHERE punch_id = {punch.PunchId}");
        var delete = () => context.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM punches WHERE punch_id = {punch.PunchId}");
        var statusOnly = () => context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE punches SET status = status WHERE punch_id = {punch.PunchId}");

        (await update.Should().ThrowAsync<PostgresException>()).Which.MessageText.Should().Contain("punches_immutable");
        (await delete.Should().ThrowAsync<PostgresException>()).Which.MessageText.Should().Contain("punches_immutable");
        await statusOnly.Should().NotThrowAsync();
        (await context.Punches.AsNoTracking().CountAsync(p => p.PunchId == punch.PunchId)).Should().Be(1);
    }

    [IntegrationFact]
    public async Task SyncOfflineAsync_ShouldNotDuplicate_WhenSameClientIdIsResentConcurrently()
    {
        var (companyId, ownerUserId) = await CreateCompanyAsync();
        var clientId = Guid.NewGuid();
        var punchedAt = DateTimeOffset.UtcNow.AddMinutes(-10).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");

        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(async () =>
        {
            using var scope = _provider!.CreateScope();
            var batch = new OfflinePunchBatchInfo
            {
                Items = new List<OfflinePunchItem> { new() { ClientId = clientId.ToString(), PunchedAt = punchedAt } }
            };
            return await scope.ServiceProvider.GetRequiredService<IPunchService>().SyncOfflineAsync(companyId, ownerUserId, batch);
        })));

        var items = results.Select(r => r.Items.Single()).ToList();
        items.Count(i => i.Result == OfflineSyncItemResult.CREATED).Should().Be(1);
        items.Count(i => i.Result == OfflineSyncItemResult.DUPLICATE).Should().Be(9);
        items.Select(i => i.Punch!.PunchId).Distinct().Should().ContainSingle();

        using var check = _provider!.CreateScope();
        var context = check.ServiceProvider.GetRequiredService<PontuaContext>();
        (await context.Punches.CountAsync(p => p.ClientId == clientId)).Should().Be(1);
        (await context.Companies.Where(c => c.CompanyId == companyId).Select(c => c.LastNsr).SingleAsync())
            .Should().Be(1, "os rollbacks das tentativas duplicadas desfazem o NSR");
    }

    /// <summary>Cria um usuário e a empresa dele pelo serviço real (cargo "Responsável" com jornada padrão).</summary>
    private async Task<(long CompanyId, long OwnerUserId)> CreateCompanyAsync()
    {
        using var scope = _provider!.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<PontuaContext>();
        var owner = NewUser("Responsável");
        context.Users.Add(owner);
        await context.SaveChangesAsync();

        var company = await scope.ServiceProvider.GetRequiredService<ICompanyService>()
            .CreateAsync(owner.UserId, new CompanyInsertInfo { Name = $"Empresa de teste {Guid.NewGuid():N}" });
        return (company.CompanyId, owner.UserId);
    }

    /// <summary>Adiciona membros ativos com o mesmo cargo do responsável; devolve os ids dos usuários.</summary>
    private async Task<List<long>> AddMembersAsync(long companyId, int count)
    {
        using var scope = _provider!.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<PontuaContext>();
        var now = DateTime.UtcNow;
        var ownerPosition = await context.MemberPositions
            .Join(context.Members, mp => mp.MemberId, m => m.MemberId, (mp, m) => new { mp, m })
            .Where(x => x.m.CompanyId == companyId)
            .Select(x => x.mp)
            .FirstAsync();

        var users = Enumerable.Range(0, count).Select(i => NewUser($"Membro {i + 1}")).ToList();
        context.Users.AddRange(users);
        await context.SaveChangesAsync();

        var members = users.Select(u => new Member
        {
            CompanyId = companyId,
            UserId = u.UserId,
            Status = MemberStatus.Active,
            JoinedAt = now,
            ActiveSince = ownerPosition.EffectiveFrom,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        context.Members.AddRange(members);
        await context.SaveChangesAsync();

        context.MemberPositions.AddRange(members.Select(m => new MemberPosition
        {
            MemberId = m.MemberId,
            PositionId = ownerPosition.PositionId,
            EffectiveFrom = ownerPosition.EffectiveFrom,
            CreatedByUserId = ownerPosition.CreatedByUserId,
            CreatedAt = now
        }));
        await context.SaveChangesAsync();
        return users.Select(u => u.UserId).ToList();
    }

    private static User NewUser(string name)
    {
        var now = DateTime.UtcNow;
        return new User
        {
            Name = name,
            Email = $"teste-{Guid.NewGuid():N}@pontua.test",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "Pontua.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
