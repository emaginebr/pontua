using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Companies;
using Pontua.DTO.Members;
using Pontua.DTO.Schedules;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

/// <summary>
/// Gestão de membros e transferência de responsabilidade (US7: FR-006, FR-011, FR-012, FR-015, FR-022c), com a
/// <see cref="CompanyAccessPolicy"/> real sobre repositórios em memória.
/// </summary>
public class MemberServiceTests
{
    /// <summary>Quarta-feira, 25/11/2026 15:00 em São Paulo (UTC−3).</summary>
    private static readonly DateTime NOW = new(2026, 11, 25, 18, 0, 0, DateTimeKind.Utc);

    private static readonly DateOnly TODAY = new(2026, 11, 25);
    private static readonly DateOnly SINCE = new(2026, 1, 1);
    private const string TIME_ZONE = "America/Sao_Paulo";

    private const long COMPANY = 3;
    private const long OTHER_COMPANY_POSITION = 99;
    private const long ANA_USER = 7;   // responsável
    private const long JOAO_USER = 8;  // atendente
    private const long MARIA_USER = 9; // atendente
    private const long ANA = 12;
    private const long JOAO = 15;
    private const long MARIA = 16;
    private const long RESPONSAVEL = 40;
    private const long ATENDENTE = 41;
    private const long CAIXA = 42;

    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<IScheduleRepository<Schedule>> _schedules = new();
    private readonly Mock<IPositionRepository<Position>> _positions = new();
    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IClock> _clock = new();

    private readonly Company _company = new()
    {
        CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = ANA_USER, TimeZone = TIME_ZONE, ManualRetroDays = 30
    };

    private readonly Dictionary<long, Position> _positionStore = new()
    {
        [RESPONSAVEL] = new() { PositionId = RESPONSAVEL, CompanyId = COMPANY, Name = "Responsável" },
        [ATENDENTE] = new() { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" },
        [CAIXA] = new() { PositionId = CAIXA, CompanyId = COMPANY, Name = "Caixa" }
    };

    private readonly List<Member> _memberStore = new();
    private readonly List<MemberPosition> _positionHistory = new();
    private readonly List<Schedule> _scheduleStore = new();
    private readonly Dictionary<long, List<long>> _managed = new();
    private readonly CompanyAccessPolicy _accessPolicy;
    private readonly CompanyClock _companyClock;

    private readonly MemberService _sut;

    public MemberServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _companyClock = new CompanyClock(_clock.Object);
        _companies.Setup(r => r.GetByIdAsync(COMPANY)).ReturnsAsync(_company);
        _companies.Setup(r => r.UpdateAsync(It.IsAny<Company>())).ReturnsAsync((Company c) => c);

        AddMember(ANA, ANA_USER, "Ana Silva", RESPONSAVEL);
        AddMember(JOAO, JOAO_USER, "João Lima", ATENDENTE);
        AddMember(MARIA, MARIA_USER, "Maria Souza", ATENDENTE);

        _members.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _memberStore.FirstOrDefault(m => m.MemberId == id));
        _members.Setup(r => r.GetByCompanyAndUserAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long userId) => _memberStore.FirstOrDefault(m => m.UserId == userId));
        _members.Setup(r => r.ListByCompanyAsync(COMPANY)).ReturnsAsync(() => _memberStore.ToList());
        _members.Setup(r => r.UpdateAsync(It.IsAny<Member>())).ReturnsAsync((Member m) => m);
        _members.Setup(r => r.ListManagedPositionIdsAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _managed.GetValueOrDefault(id)?.ToList() ?? new List<long>());
        _members.Setup(r => r.ReplaceManagedPositionsAsync(It.IsAny<long>(), It.IsAny<IEnumerable<ManagerPosition>>()))
            .Returns((long id, IEnumerable<ManagerPosition> list) =>
            {
                _managed[id] = list.Select(mp => mp.PositionId).ToList();
                return Task.CompletedTask;
            });
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _positionHistory.Where(mp => ids.Contains(mp.MemberId)).ToList());
        _members.Setup(r => r.GetPositionIdOnAsync(It.IsAny<long>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long id, DateOnly date) => _positionHistory
                .Where(mp => mp.MemberId == id && mp.EffectiveFrom <= date).MaxBy(mp => mp.EffectiveFrom)?.PositionId);
        _members.Setup(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>())).ReturnsAsync((MemberPosition mp) =>
        {
            _positionHistory.RemoveAll(x => x.MemberId == mp.MemberId && x.EffectiveFrom == mp.EffectiveFrom);
            mp.Position = _positionStore[mp.PositionId];
            _positionHistory.Add(mp);
            return mp;
        });

        _positions.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _positionStore.GetValueOrDefault(id));
        _positions.Setup(r => r.ListByCompanyAsync(COMPANY)).ReturnsAsync(() => _positionStore.Values.ToList());

        // Jornada padrão (seg–sex, 480/2400) em todos os cargos.
        foreach (var positionId in _positionStore.Keys)
            AddSchedule(ScheduleFactory.Create(ScheduleFactory.DefaultWeekly(), COMPANY, positionId, null, SINCE, ANA_USER, NOW));
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _scheduleStore.Where(s => s.PositionId != null && ids.Contains(s.PositionId.Value)).ToList());
        _schedules.Setup(r => r.ListByMembersAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _scheduleStore.Where(s => s.MemberId != null && ids.Contains(s.MemberId.Value)).ToList());
        _schedules.Setup(r => r.GetByMemberAndDateAsync(It.IsAny<long>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long id, DateOnly date) => _scheduleStore.FirstOrDefault(s => s.MemberId == id && s.EffectiveFrom == date));
        _schedules.Setup(r => r.InsertAsync(It.IsAny<Schedule>())).ReturnsAsync((Schedule s) => AddSchedule(s));
        _schedules.Setup(r => r.DeleteAsync(It.IsAny<long>()))
            .Returns((long id) =>
            {
                _scheduleStore.RemoveAll(s => s.ScheduleId == id);
                return Task.CompletedTask;
            });

        var users = _memberStore.ToDictionary(m => m.UserId, m => m.User!);
        _users.Setup(r => r.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => users.GetValueOrDefault(id));

        _accessPolicy = new CompanyAccessPolicy(_companies.Object, _members.Object);
        _sut = new MemberService(
            _members.Object,
            _schedules.Object,
            _positions.Object,
            _companies.Object,
            _unitOfWork.Object,
            _accessPolicy,
            new ScheduleResolver(),
            _companyClock,
            _clock.Object,
            new MemberPositionUpdateInfoValidator(),
            new ManagerUpdateInfoValidator(),
            new ScheduleInputValidator(),
            NullLogger<MemberService>.Instance);
    }

    private void AddMember(long memberId, long userId, string name, long positionId)
    {
        _memberStore.Add(new Member
        {
            MemberId = memberId, CompanyId = COMPANY, UserId = userId, Status = MemberStatus.Active, ActiveSince = SINCE,
            User = new User { UserId = userId, Name = name, Email = $"{userId}@ex.com" }
        });
        _positionHistory.Add(new MemberPosition
        {
            MemberId = memberId, PositionId = positionId, EffectiveFrom = SINCE, Position = _positionStore[positionId]
        });
    }

    private Schedule AddSchedule(Schedule schedule)
    {
        schedule.ScheduleId = 900 + _scheduleStore.Count;
        _scheduleStore.Add(schedule);
        return schedule;
    }

    private Member Member(long id) => _memberStore.Single(m => m.MemberId == id);

    private ResolvedSchedule? Resolve(long memberId, DateOnly date) =>
        new ScheduleResolver().Resolve(memberId, date, _positionHistory, _scheduleStore);

    private static ScheduleInput SaturdaySchedule(DateOnly? effectiveFrom = null) => new()
    {
        Mode = ScheduleInput.MODE_WEEKLY,
        EffectiveFrom = effectiveFrom,
        WeeklyMinutes = 1440,
        DailyMinutes = 240,
        WorkDays = new List<int> { 1, 3, 5, 6 },
        Periods = new List<SchedulePeriodInput> { new() { Name = "Entrada" }, new() { Name = "Saída" } }
    };

    private CompanyService CreateCompanyService() => new(
        _companies.Object,
        _members.Object,
        _positions.Object,
        _schedules.Object,
        _users.Object,
        _unitOfWork.Object,
        _accessPolicy,
        _companyClock,
        _clock.Object,
        new CompanyInsertInfoValidator(),
        new CompanyUpdateInfoValidator(),
        new TransferOwnershipInfoValidator(),
        NullLogger<CompanyService>.Instance);

    // ---------- Cargo com vigência ----------

    [Fact]
    public async Task ChangePositionAsync_ShouldKeepPastDaysWithOldPosition_WhenEffectiveFromIsInTheFuture()
    {
        var effectiveFrom = TODAY.AddDays(6); // terça, 01/12

        var info = await _sut.ChangePositionAsync(COMPANY, ANA_USER, JOAO,
            new MemberPositionUpdateInfo { PositionId = CAIXA, EffectiveFrom = effectiveFrom });

        info.Position!.PositionId.Should().Be(ATENDENTE, "a mudança ainda não vigora hoje");
        info.PositionHistory.Should().NotBeNull();
        info.PositionHistory!.Select(p => (p.PositionId, p.EffectiveFrom)).Should().Equal((CAIXA, effectiveFrom), (ATENDENTE, SINCE));
        Resolve(JOAO, TODAY)!.PositionId.Should().Be(ATENDENTE);
        Resolve(JOAO, TODAY.AddDays(-7))!.PositionId.Should().Be(ATENDENTE, "dias passados preservam o cargo da época");
        Resolve(JOAO, effectiveFrom)!.PositionId.Should().Be(CAIXA);
    }

    [Fact]
    public async Task ChangePositionAsync_ShouldDefaultToToday()
    {
        var info = await _sut.ChangePositionAsync(COMPANY, ANA_USER, JOAO, new MemberPositionUpdateInfo { PositionId = CAIXA });

        info.Position!.PositionId.Should().Be(CAIXA);
        _positionHistory.Should().Contain(mp => mp.MemberId == JOAO && mp.EffectiveFrom == TODAY && mp.PositionId == CAIXA);
    }

    [Fact]
    public async Task ChangePositionAsync_ShouldThrowBusinessRule_WhenEffectiveFromIsInThePast()
    {
        var act = () => _sut.ChangePositionAsync(COMPANY, ANA_USER, JOAO,
            new MemberPositionUpdateInfo { PositionId = CAIXA, EffectiveFrom = TODAY.AddDays(-1) });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(MemberService.PAST_EFFECTIVE_FROM_MESSAGE);
    }

    [Fact]
    public async Task ChangePositionAsync_ShouldThrowNotFound_WhenPositionIsFromAnotherCompany()
    {
        var act = () => _sut.ChangePositionAsync(COMPANY, ANA_USER, JOAO, new MemberPositionUpdateInfo { PositionId = OTHER_COMPANY_POSITION });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task ChangePositionAsync_ShouldThrowForbidden_WhenCallerIsNotOwner()
    {
        var act = () => _sut.ChangePositionAsync(COMPANY, JOAO_USER, MARIA, new MemberPositionUpdateInfo { PositionId = CAIXA });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    // ---------- Jornada própria ----------

    [Fact]
    public async Task SetOwnScheduleAsync_ShouldPrevailOverPositionSchedule()
    {
        var info = await _sut.SetOwnScheduleAsync(COMPANY, ANA_USER, MARIA, SaturdaySchedule());

        info.EffectiveFrom.Should().Be(TODAY);
        info.Days.Select(d => d.DayOfWeek).Should().Equal(1, 3, 5, 6);
        var saturday = Resolve(MARIA, new DateOnly(2026, 11, 28))!;
        saturday.IsMemberSchedule.Should().BeTrue();
        saturday.IsWorkDay.Should().BeTrue("a jornada própria inclui o sábado");
        Resolve(MARIA, new DateOnly(2026, 12, 1))!.IsWorkDay.Should().BeFalse("terça não é dia útil da jornada própria");
        Resolve(MARIA, TODAY.AddDays(-7))!.IsMemberSchedule.Should().BeFalse("dias anteriores seguem a jornada do cargo");

        var detail = await _sut.GetAsync(COMPANY, ANA_USER, MARIA);
        detail.HasOwnSchedule.Should().BeTrue();
        detail.ScheduleHistory.Should().ContainSingle().Which.InheritsPosition.Should().BeNull();
    }

    [Fact]
    public async Task SetOwnScheduleAsync_ShouldReplaceVersion_WhenSavingAgainOnTheSameDate()
    {
        await _sut.SetOwnScheduleAsync(COMPANY, ANA_USER, MARIA, SaturdaySchedule(TODAY.AddDays(3)));
        await _sut.SetOwnScheduleAsync(COMPANY, ANA_USER, MARIA, SaturdaySchedule(TODAY.AddDays(3)));

        _scheduleStore.Count(s => s.MemberId == MARIA).Should().Be(1);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Exactly(2));
    }

    [Fact]
    public async Task SetOwnScheduleAsync_ShouldThrowBusinessRule_WhenEffectiveFromIsInThePast()
    {
        var act = () => _sut.SetOwnScheduleAsync(COMPANY, ANA_USER, MARIA, SaturdaySchedule(TODAY.AddDays(-1)));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task ClearOwnScheduleAsync_ShouldInsertInheritsPositionVersion_WhenOwnScheduleWasInEffect()
    {
        AddSchedule(ScheduleFactory.Create(SaturdaySchedule(), COMPANY, null, MARIA, new DateOnly(2026, 11, 1), ANA_USER, NOW));
        var future = AddSchedule(ScheduleFactory.Create(SaturdaySchedule(), COMPANY, null, MARIA, TODAY.AddDays(10), ANA_USER, NOW));

        await _sut.ClearOwnScheduleAsync(COMPANY, ANA_USER, MARIA, TODAY.AddDays(2));

        _scheduleStore.Should().NotContain(future, "versões futuras a partir da data são descartadas");
        _scheduleStore.Should().ContainSingle(s => s.MemberId == MARIA && s.InheritsPosition && s.EffectiveFrom == TODAY.AddDays(2));
        Resolve(MARIA, TODAY)!.IsMemberSchedule.Should().BeTrue();
        Resolve(MARIA, TODAY.AddDays(2))!.IsMemberSchedule.Should().BeFalse("volta à jornada do cargo");
        Resolve(MARIA, TODAY.AddDays(20))!.PositionId.Should().Be(ATENDENTE);
        Resolve(MARIA, TODAY.AddDays(20))!.IsMemberSchedule.Should().BeFalse();
    }

    [Fact]
    public async Task ClearOwnScheduleAsync_ShouldOnlyRemoveVersion_WhenOwnScheduleStartsOnTheSameDate()
    {
        AddSchedule(ScheduleFactory.Create(SaturdaySchedule(), COMPANY, null, MARIA, TODAY, ANA_USER, NOW));

        await _sut.ClearOwnScheduleAsync(COMPANY, ANA_USER, MARIA, null);

        _scheduleStore.Should().NotContain(s => s.MemberId == MARIA);
        Resolve(MARIA, TODAY)!.IsMemberSchedule.Should().BeFalse();
    }

    // ---------- Desativação / reativação ----------

    [Fact]
    public async Task DeactivateAsync_ShouldThrowBusinessRule_WhenTargetIsTheOwner()
    {
        var act = () => _sut.DeactivateAsync(COMPANY, ANA_USER, ANA);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(MemberService.DEACTIVATE_OWNER_MESSAGE);
        Member(ANA).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task DeactivateAsync_ShouldDeactivateAndClearManagerDesignation()
    {
        Member(JOAO).IsManager = true;
        _managed[JOAO] = new List<long> { ATENDENTE };

        await _sut.DeactivateAsync(COMPANY, ANA_USER, JOAO);

        var joao = Member(JOAO);
        joao.Status.Should().Be(MemberStatus.Inactive);
        joao.DeactivatedAt.Should().Be(NOW);
        joao.IsManager.Should().BeFalse();
        _managed[JOAO].Should().BeEmpty();
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task DeactivatedMember_ShouldNotBeAbleToPunch()
    {
        await _sut.DeactivateAsync(COMPANY, ANA_USER, MARIA);

        // A marcação (e qualquer rota de membro) passa por RequireMemberAsync: sem vínculo ativo → 404.
        var act = () => _accessPolicy.RequireMemberAsync(COMPANY, MARIA_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task ReactivateAsync_ShouldActivateFromToday()
    {
        var maria = Member(MARIA);
        maria.Status = MemberStatus.Inactive;
        maria.DeactivatedAt = NOW.AddDays(-10);

        await _sut.ReactivateAsync(COMPANY, ANA_USER, MARIA);

        maria.Status.Should().Be(MemberStatus.Active);
        maria.DeactivatedAt.Should().BeNull();
        maria.ActiveSince.Should().Be(TODAY);
        (await _accessPolicy.RequireMemberAsync(COMPANY, MARIA_USER)).MemberId.Should().Be(MARIA);
    }

    // ---------- Gestores ----------

    [Fact]
    public async Task SetManagerAsync_ShouldDesignateManagerOfPositions()
    {
        var info = await _sut.SetManagerAsync(COMPANY, ANA_USER, JOAO,
            new ManagerUpdateInfo { IsManager = true, PositionIds = new List<long> { CAIXA, ATENDENTE, CAIXA } });

        info.IsManager.Should().BeTrue();
        info.ManagedPositionIds.Should().Equal(ATENDENTE, CAIXA);
        Member(JOAO).IsManager.Should().BeTrue();

        var context = await _accessPolicy.GetContextAsync(COMPANY, JOAO_USER);
        context.CanSuperviseAnyone.Should().BeTrue();
        (await _accessPolicy.CanSuperviseAsync(context, MARIA, TODAY)).Should().BeTrue();
        (await _accessPolicy.CanSuperviseAsync(context, ANA, TODAY)).Should().BeFalse("Ana não é de um cargo supervisionado");
    }

    [Fact]
    public async Task SetManagerAsync_ShouldClearPositions_WhenIsManagerIsFalse()
    {
        Member(JOAO).IsManager = true;
        _managed[JOAO] = new List<long> { ATENDENTE };

        var info = await _sut.SetManagerAsync(COMPANY, ANA_USER, JOAO,
            new ManagerUpdateInfo { IsManager = false, PositionIds = new List<long> { ATENDENTE } });

        info.IsManager.Should().BeFalse();
        info.ManagedPositionIds.Should().BeEmpty();
        _managed[JOAO].Should().BeEmpty();
    }

    [Fact]
    public async Task SetManagerAsync_ShouldThrowNotFound_WhenPositionIsNotFromTheCompany()
    {
        var act = () => _sut.SetManagerAsync(COMPANY, ANA_USER, JOAO,
            new ManagerUpdateInfo { IsManager = true, PositionIds = new List<long> { ATENDENTE, OTHER_COMPANY_POSITION } });

        await act.Should().ThrowAsync<NotFoundException>();
        Member(JOAO).IsManager.Should().BeFalse();
    }

    [Fact]
    public async Task SetManagerAsync_ShouldThrowValidation_WhenManagerHasNoPositions()
    {
        var act = () => _sut.SetManagerAsync(COMPANY, ANA_USER, JOAO, new ManagerUpdateInfo { IsManager = true });

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task SetManagerAsync_ShouldThrowBusinessRule_WhenTargetIsOwnerOrInactive()
    {
        Member(MARIA).Status = MemberStatus.Inactive;
        var info = new ManagerUpdateInfo { IsManager = true, PositionIds = new List<long> { ATENDENTE } };

        var owner = () => _sut.SetManagerAsync(COMPANY, ANA_USER, ANA, info);
        var inactive = () => _sut.SetManagerAsync(COMPANY, ANA_USER, MARIA, info);

        await owner.Should().ThrowAsync<BusinessRuleException>().WithMessage(MemberService.OWNER_AS_MANAGER_MESSAGE);
        await inactive.Should().ThrowAsync<BusinessRuleException>().WithMessage(MemberService.INACTIVE_MANAGER_MESSAGE);
    }

    // ---------- Detalhe ----------

    [Fact]
    public async Task GetAsync_ShouldAllowSelfAndForbidOtherRegularMember()
    {
        var self = await _sut.GetAsync(COMPANY, MARIA_USER, MARIA);
        var other = () => _sut.GetAsync(COMPANY, MARIA_USER, JOAO);

        self.MemberId.Should().Be(MARIA);
        self.PositionHistory.Should().ContainSingle().Which.Name.Should().Be("Atendente");
        await other.Should().ThrowAsync<ForbiddenException>();
    }

    // ---------- Transferência de responsabilidade ----------

    [Fact]
    public async Task TransferOwnershipAsync_ShouldMakeTargetOwnerAndClearHisManagerDesignation()
    {
        Member(JOAO).IsManager = true;
        _managed[JOAO] = new List<long> { ATENDENTE };

        var info = await CreateCompanyService().TransferOwnershipAsync(COMPANY, ANA_USER, new TransferOwnershipInfo { MemberId = JOAO });

        _company.OwnerUserId.Should().Be(JOAO_USER);
        info.Owner.MemberId.Should().Be(JOAO);
        info.MyAccess.IsOwner.Should().BeFalse("a resposta reflete o acesso de quem transferiu");
        Member(JOAO).IsManager.Should().BeFalse();
        _managed[JOAO].Should().BeEmpty();
        Member(ANA).IsActive.Should().BeTrue("o antigo responsável continua membro");
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);

        // O antigo responsável perde as operações administrativas (403).
        var act = () => _sut.ChangePositionAsync(COMPANY, ANA_USER, MARIA, new MemberPositionUpdateInfo { PositionId = CAIXA });
        await act.Should().ThrowAsync<ForbiddenException>();
        await _sut.DeactivateAsync(COMPANY, JOAO_USER, ANA);
        Member(ANA).IsActive.Should().BeFalse("o antigo responsável agora pode ser desativado pelo novo");
    }

    [Fact]
    public async Task TransferOwnershipAsync_ShouldThrowBusinessRule_WhenTargetIsInactive()
    {
        Member(MARIA).Status = MemberStatus.Inactive;

        var act = () => CreateCompanyService().TransferOwnershipAsync(COMPANY, ANA_USER, new TransferOwnershipInfo { MemberId = MARIA });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(CompanyService.TRANSFER_INACTIVE_TARGET_MESSAGE);
        _company.OwnerUserId.Should().Be(ANA_USER);
    }

    [Fact]
    public async Task TransferOwnershipAsync_ShouldThrowForbiddenOrNotFound_WhenCallerIsNotOwnerOrTargetDoesNotExist()
    {
        var service = CreateCompanyService();

        var notOwner = () => service.TransferOwnershipAsync(COMPANY, JOAO_USER, new TransferOwnershipInfo { MemberId = JOAO });
        var missing = () => service.TransferOwnershipAsync(COMPANY, ANA_USER, new TransferOwnershipInfo { MemberId = 999 });
        var invalid = () => service.TransferOwnershipAsync(COMPANY, ANA_USER, new TransferOwnershipInfo());

        await notOwner.Should().ThrowAsync<ForbiddenException>();
        await missing.Should().ThrowAsync<NotFoundException>();
        await invalid.Should().ThrowAsync<ValidationException>();
    }
}
