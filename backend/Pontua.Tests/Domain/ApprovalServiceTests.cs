using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Approvals;
using Pontua.DTO.Punches;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

/// <summary>
/// Painel de pendências e aprovação/rejeição (US6: FR-022d/e, FR-023 a FR-025, R-11, R-12), com a
/// <see cref="CompanyAccessPolicy"/> real sobre repositórios em memória.
/// </summary>
public class ApprovalServiceTests
{
    /// <summary>Quarta-feira, 25/11/2026 15:00 em São Paulo (UTC−3).</summary>
    private static readonly DateTime NOW = new(2026, 11, 25, 18, 0, 0, DateTimeKind.Utc);

    private static readonly DateOnly MON = new(2026, 11, 23);
    private static readonly DateOnly TUE = MON.AddDays(1);
    private static readonly DateOnly WED = MON.AddDays(2);
    private const string TIME_ZONE = "America/Sao_Paulo";

    private const long COMPANY = 3;
    private const long ANA_USER = 7;   // responsável
    private const long JOAO_USER = 8;  // gestor do cargo Atendente
    private const long MARIA_USER = 9; // atendente
    private const long PEDRO_USER = 10; // caixa
    private const long ANA = 12;
    private const long JOAO = 15;
    private const long MARIA = 16;
    private const long PEDRO = 17;
    private const long RESPONSAVEL = 40;
    private const long ATENDENTE = 41;
    private const long CAIXA = 42;

    private readonly Mock<IPunchRepository<Punch, PunchStatusChange>> _punches = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<IScheduleRepository<Schedule>> _schedules = new();
    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IClock> _clock = new();

    private readonly List<Member> _memberStore = new();
    private readonly List<MemberPosition> _positionHistory = new();
    private readonly Dictionary<long, List<long>> _managed = new() { [JOAO] = new List<long> { ATENDENTE } };
    private readonly List<Punch> _store = new();
    private readonly List<PunchStatusChange> _changes = new();
    private readonly CompanyClock _companyClock;
    private long _lastNsr;

    private readonly ApprovalService _sut;

    public ApprovalServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _companyClock = new CompanyClock(_clock.Object);
        _companies.Setup(r => r.GetByIdAsync(COMPANY)).ReturnsAsync(new Company
        {
            CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = ANA_USER, TimeZone = TIME_ZONE, ManualRetroDays = 30
        });

        var positions = new Dictionary<long, Position>
        {
            [RESPONSAVEL] = new() { PositionId = RESPONSAVEL, CompanyId = COMPANY, Name = "Responsável" },
            [ATENDENTE] = new() { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" },
            [CAIXA] = new() { PositionId = CAIXA, CompanyId = COMPANY, Name = "Caixa" }
        };
        AddMember(ANA, ANA_USER, "Ana Silva", RESPONSAVEL, positions);
        AddMember(JOAO, JOAO_USER, "João Lima", ATENDENTE, positions, isManager: true);
        AddMember(MARIA, MARIA_USER, "Maria Souza", ATENDENTE, positions);
        AddMember(PEDRO, PEDRO_USER, "Pedro Alves", CAIXA, positions);

        _members.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _memberStore.FirstOrDefault(m => m.MemberId == id));
        _members.Setup(r => r.GetByCompanyAndUserAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long userId) => _memberStore.FirstOrDefault(m => m.UserId == userId));
        _members.Setup(r => r.ListByCompanyAsync(COMPANY)).ReturnsAsync(() => _memberStore.ToList());
        _members.Setup(r => r.ListManagedPositionIdsAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _managed.GetValueOrDefault(id)?.ToList() ?? new List<long>());
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _positionHistory.Where(mp => ids.Contains(mp.MemberId)).ToList());
        _members.Setup(r => r.GetPositionIdOnAsync(It.IsAny<long>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long id, DateOnly date) => _positionHistory
                .Where(mp => mp.MemberId == id && mp.EffectiveFrom <= date)
                .MaxBy(mp => mp.EffectiveFrom)?.PositionId);

        // Jornada padrão (seg–sex, 4 períodos, 480 min) para os três cargos.
        var schedules = positions.Keys.Select((id, i) =>
        {
            var schedule = ScheduleFactory.Create(ScheduleFactory.DefaultWeekly(), COMPANY, id, null, new DateOnly(2026, 1, 1), ANA_USER, NOW);
            schedule.ScheduleId = 90 + i;
            return schedule;
        }).ToList();
        _schedules.Setup(r => r.ListByMembersAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>());
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => schedules.Where(s => ids.Contains(s.PositionId!.Value)).ToList());

        _punches.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _store.FirstOrDefault(p => p.PunchId == id));
        _punches.Setup(r => r.ListByCompanyAsync(COMPANY, It.IsAny<DateOnly>(), It.IsAny<DateOnly>(), It.IsAny<IEnumerable<long>?>()))
            .ReturnsAsync((long _, DateOnly start, DateOnly end, IEnumerable<long>? ids) => _store
                .Where(p => p.WorkDate >= start && p.WorkDate <= end && (ids == null || ids.Contains(p.MemberId)))
                .OrderBy(p => p.PunchedAt).ToList());
        _punches.Setup(r => r.ListByMemberAsync(It.IsAny<long>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long id, DateOnly start, DateOnly end) => _store
                .Where(p => p.MemberId == id && p.WorkDate >= start && p.WorkDate <= end).OrderBy(p => p.PunchedAt).ToList());
        _punches.Setup(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()))
            .ReturnsAsync((Punch p, PunchStatusChange change) =>
            {
                change.PunchId = p.PunchId;
                _changes.Add(change);
                return true;
            });
        _punches.Setup(r => r.ListStatusHistoriesAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _changes.Where(c => ids.Contains(c.PunchId)).ToList());

        var names = _memberStore.ToDictionary(m => m.UserId, m => m.User!);
        _users.Setup(r => r.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => names.GetValueOrDefault(id));
        _users.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Where(names.ContainsKey).Select(id => names[id]).ToList());

        _sut = new ApprovalService(
            _punches.Object,
            _members.Object,
            _schedules.Object,
            _companies.Object,
            _users.Object,
            _unitOfWork.Object,
            new CompanyAccessPolicy(_companies.Object, _members.Object),
            new ScheduleResolver(),
            _companyClock,
            _clock.Object,
            new ReviewInsertInfoValidator(),
            NullLogger<ApprovalService>.Instance);
    }

    private void AddMember(long memberId, long userId, string name, long positionId, Dictionary<long, Position> positions, bool isManager = false)
    {
        _memberStore.Add(new Member
        {
            MemberId = memberId, CompanyId = COMPANY, UserId = userId, Status = MemberStatus.Active, IsManager = isManager,
            ActiveSince = new DateOnly(2026, 1, 1), User = new User { UserId = userId, Name = name }
        });
        _positionHistory.Add(new MemberPosition
        {
            MemberId = memberId, PositionId = positionId, EffectiveFrom = new DateOnly(2026, 1, 1), Position = positions[positionId]
        });
    }

    private static void SetPunchId(Punch punch, long id) =>
        typeof(Punch).GetProperty(nameof(Punch.PunchId))!.SetValue(punch, id);

    private Punch AddPunch(long memberId, DateOnly date, string time, PunchStatus status = PunchStatus.Valid,
        PunchKind kind = PunchKind.Normal, long? replaces = null)
    {
        var punchedAt = _companyClock.ToUtc(date, TimeOnly.Parse(time), TIME_ZONE);
        var initial = status is PunchStatus.Valid or PunchStatus.Superseded ? PunchStatus.Valid : PunchStatus.Pending;
        var reason = kind switch { PunchKind.Manual => PendingReason.Manual, PunchKind.Offline => PendingReason.Offline, _ => PendingReason.OutsideWorkday };
        var punch = Punch.Create(COMPANY, memberId, ++_lastNsr, kind, punchedAt, date, punchedAt, initial,
            initial == PunchStatus.Pending ? reason : null, _memberStore.Single(m => m.MemberId == memberId).UserId,
            justification: kind == PunchKind.Manual ? "Esqueci de marcar" : null, replacesPunchId: replaces,
            clientId: kind == PunchKind.Offline ? Guid.NewGuid() : null);
        if (status != initial)
            punch.ChangeStatus(status, ANA_USER, null, NOW.AddDays(-1));
        SetPunchId(punch, 500 + _store.Count);
        _store.Add(punch);
        return punch;
    }

    private void AddFullDay(long memberId, DateOnly date)
    {
        AddPunch(memberId, date, "08:00");
        AddPunch(memberId, date, "12:00");
        AddPunch(memberId, date, "13:00");
        AddPunch(memberId, date, "17:00");
    }

    /// <summary>
    /// Ana (responsável) marca seg–qua; João (gestor) marca seg–qua e tem uma offline pendente na terça; Maria marca
    /// segunda, tem uma manual pendente na terça e nada na quarta; Pedro não marca nada.
    /// </summary>
    private (Punch MariaManual, Punch JoaoOffline) Scenario()
    {
        foreach (var day in new[] { MON, TUE, WED })
        {
            AddFullDay(ANA, day);
            AddFullDay(JOAO, day);
        }
        var joaoOffline = AddPunch(JOAO, TUE, "18:30", PunchStatus.Pending, PunchKind.Offline);
        AddFullDay(MARIA, MON);
        var mariaManual = AddPunch(MARIA, TUE, "08:00", PunchStatus.Pending, PunchKind.Manual);
        return (mariaManual, joaoOffline);
    }

    private static PanelQuery Range(DateOnly start, DateOnly end, string? type = null, long? positionId = null) => new()
    {
        Start = start.ToString("yyyy-MM-dd"), End = end.ToString("yyyy-MM-dd"), Type = type, PositionId = positionId
    };

    private static IEnumerable<(DateOnly Date, string Name, string Situation)> Flatten(IEnumerable<PendingPanelDay> days) =>
        days.SelectMany(d => d.Members.Select(m => (d.Date, m.Name, m.Situation)));

    // ---------- Painel ----------

    [Fact]
    public async Task GetPanelAsync_ShouldListMissingAndPendingByDayDescendingAndMembersByName_WhenOwner()
    {
        Scenario();

        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED));

        panel.Select(d => d.Date).Should().Equal(WED, TUE, MON);
        Flatten(panel).Should().Equal(
            (WED, "Maria Souza", "missing"),
            (WED, "Pedro Alves", "missing"),
            (TUE, "João Lima", "pending"),
            (TUE, "Maria Souza", "pending"),
            (TUE, "Pedro Alves", "missing"),
            (MON, "Pedro Alves", "missing"));

        var maria = panel.Single(d => d.Date == TUE).Members.Single(m => m.MemberId == MARIA);
        maria.Position.Should().Be("Atendente");
        maria.IsWorkDay.Should().BeTrue();
        maria.Punches.Should().ContainSingle().Which.Should().Match<PunchInfo>(p =>
            p.Kind == "manual" && p.Status == "pending" && p.PendingReason == "manual" && p.Justification == "Esqueci de marcar");
    }

    [Theory]
    [InlineData("missing", 4)]
    [InlineData("pending", 2)]
    [InlineData("all", 6)]
    [InlineData(null, 6)]
    public async Task GetPanelAsync_ShouldFilterByType(string? type, int expected)
    {
        Scenario();

        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED, type));

        var entries = Flatten(panel).ToList();
        entries.Should().HaveCount(expected);
        if (type is "missing" or "pending")
            entries.Should().OnlyContain(e => e.Situation == type);
    }

    [Fact]
    public async Task GetPanelAsync_ShouldFilterByPosition()
    {
        Scenario();

        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED, positionId: ATENDENTE));

        Flatten(panel).Select(e => e.Name).Distinct().Should().BeEquivalentTo("João Lima", "Maria Souza");
    }

    [Fact]
    public async Task GetPanelAsync_ShouldRestrictToManagedPositionsAndHideManagerHimself_WhenManager()
    {
        Scenario();

        var panel = await _sut.GetPanelAsync(COMPANY, JOAO_USER, Range(MON, WED));

        Flatten(panel).Select(e => e.Name).Distinct().Should().Equal("Maria Souza");
    }

    [Fact]
    public async Task GetPanelAsync_ShouldThrowForbidden_WhenRegularMember()
    {
        var act = () => _sut.GetPanelAsync(COMPANY, MARIA_USER, Range(MON, WED));

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage(ApprovalService.PANEL_FORBIDDEN_MESSAGE);
    }

    [Fact]
    public async Task GetPanelAsync_ShouldThrowValidation_WhenTypeIsInvalid()
    {
        var act = () => _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED, "late"));

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task GetPanelAsync_ShouldLeaveDeactivatedMemberOut_FromDeactivationDayOn()
    {
        Scenario();
        var pedro = _memberStore.Single(m => m.MemberId == PEDRO);
        pedro.Status = MemberStatus.Inactive;
        pedro.DeactivatedAt = _companyClock.ToUtc(TUE, new TimeOnly(10, 0), TIME_ZONE);

        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED));

        Flatten(panel).Where(e => e.Name == "Pedro Alves").Should().ContainSingle().Which.Date.Should().Be(MON);
    }

    [Fact]
    public async Task GetPanelAsync_ShouldIgnoreDaysBeforeActiveSince()
    {
        _memberStore.Single(m => m.MemberId == PEDRO).ActiveSince = WED;

        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(MON, WED, "missing"));

        Flatten(panel).Where(e => e.Name == "Pedro Alves").Should().ContainSingle().Which.Date.Should().Be(WED);
    }

    [Fact]
    public async Task GetPanelAsync_ShouldNotReportMissing_ForFutureDays()
    {
        var panel = await _sut.GetPanelAsync(COMPANY, ANA_USER, Range(WED, WED.AddDays(2), "missing"));

        panel.Select(d => d.Date).Should().Equal(WED);
    }

    // ---------- Aprovação / rejeição ----------

    [Fact]
    public async Task ApproveAsync_ShouldApprovePendingPunchAndRecordReviewer_WhenOwner()
    {
        var (mariaManual, _) = Scenario();

        var info = await _sut.ApproveAsync(COMPANY, ANA_USER, mariaManual.PunchId, new ReviewInsertInfo { Note = " ok " });

        info.Status.Should().Be("approved");
        info.CountsAsWorked.Should().BeTrue("aprovada passa a contar nas horas");
        info.Review!.By.Should().Be("Ana Silva");
        info.Review.At.Should().Be(NOW);
        info.Review.Note.Should().Be("ok");
        _changes.Should().ContainSingle().Which.Should().Match<PunchStatusChange>(c =>
            c.PunchId == mariaManual.PunchId && c.FromStatus == PunchStatus.Pending && c.ToStatus == PunchStatus.Approved &&
            c.ChangedByUserId == ANA_USER && c.ChangedAt == NOW && c.Note == "ok");
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task RejectAsync_ShouldRejectWithReason_WhenManagerOfMembersPosition()
    {
        var (mariaManual, _) = Scenario();

        var info = await _sut.RejectAsync(COMPANY, JOAO_USER, mariaManual.PunchId, new ReviewInsertInfo { Note = "Não estava na loja." });

        info.Status.Should().Be("rejected");
        info.CountsAsWorked.Should().BeFalse();
        info.Review!.By.Should().Be("João Lima");
        _changes.Single().Note.Should().Be("Não estava na loja.");
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowForbidden_WhenManagerReviewsOwnPunch()
    {
        var (_, joaoOffline) = Scenario();

        var act = () => _sut.ApproveAsync(COMPANY, JOAO_USER, joaoOffline.PunchId, null);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage(ApprovalService.OWN_PUNCH_MESSAGE);
        joaoOffline.Status.Should().Be(PunchStatus.Pending);
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowForbidden_WhenManagerReviewsMemberOutsideHisPositions()
    {
        var pedroPending = AddPunch(PEDRO, TUE, "09:00", PunchStatus.Pending, PunchKind.Manual);

        var act = () => _sut.ApproveAsync(COMPANY, JOAO_USER, pedroPending.PunchId, null);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowForbidden_WhenRegularMember()
    {
        var (_, joaoOffline) = Scenario();

        var act = () => _sut.ApproveAsync(COMPANY, MARIA_USER, joaoOffline.PunchId, null);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task ApproveAsync_ShouldAllowOwnerToApproveOwnPunch()
    {
        var anaSaturday = AddPunch(ANA, new DateOnly(2026, 11, 21), "09:00", PunchStatus.Pending);

        var info = await _sut.ApproveAsync(COMPANY, ANA_USER, anaSaturday.PunchId, null);

        info.Status.Should().Be("approved");
    }

    [Theory]
    [InlineData(PunchStatus.Approved)]
    [InlineData(PunchStatus.Rejected)]
    [InlineData(PunchStatus.Cancelled)]
    [InlineData(PunchStatus.Valid)]
    public async Task ApproveAsync_ShouldThrowConflict_WhenPunchIsNotPending(PunchStatus status)
    {
        var punch = AddPunch(MARIA, TUE, "08:00", status, PunchKind.Manual);

        var act = () => _sut.ApproveAsync(COMPANY, ANA_USER, punch.PunchId, null);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(ApprovalService.NOT_PENDING_MESSAGE);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowConflictAndRollback_WhenAnotherReviewerWasFaster()
    {
        var (mariaManual, _) = Scenario();
        _punches.Setup(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>())).ReturnsAsync(false);

        var act = () => _sut.ApproveAsync(COMPANY, ANA_USER, mariaManual.PunchId, null);

        await act.Should().ThrowAsync<ConflictException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task ApproveAsync_ShouldSupersedeOriginalInSameTransaction_WhenApprovingCorrection()
    {
        var original = AddPunch(MARIA, MON, "08:30");
        var correction = AddPunch(MARIA, MON, "08:00", PunchStatus.Pending, PunchKind.Manual, replaces: original.PunchId);

        var info = await _sut.ApproveAsync(COMPANY, ANA_USER, correction.PunchId, null);

        info.Status.Should().Be("approved");
        original.Status.Should().Be(PunchStatus.Superseded);
        original.CountsAsWorked.Should().BeFalse();
        _changes.Select(c => (c.PunchId, c.FromStatus, c.ToStatus)).Should().Equal(
            (correction.PunchId, PunchStatus.Pending, PunchStatus.Approved),
            (original.PunchId, PunchStatus.Valid, PunchStatus.Superseded));
        _changes.Last().Note.Should().Contain(correction.Nsr.ToString());
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task RejectAsync_ShouldKeepOriginal_WhenRejectingCorrection()
    {
        var original = AddPunch(MARIA, MON, "08:30");
        var correction = AddPunch(MARIA, MON, "08:00", PunchStatus.Pending, PunchKind.Manual, replaces: original.PunchId);

        await _sut.RejectAsync(COMPANY, ANA_USER, correction.PunchId, null);

        original.Status.Should().Be(PunchStatus.Valid);
        _changes.Should().ContainSingle();
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowConflictAndRollback_WhenOriginalWasAlreadySuperseded()
    {
        var original = AddPunch(MARIA, MON, "08:30", PunchStatus.Superseded);
        var correction = AddPunch(MARIA, MON, "08:00", PunchStatus.Pending, PunchKind.Manual, replaces: original.PunchId);

        var act = () => _sut.ApproveAsync(COMPANY, ANA_USER, correction.PunchId, null);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(ApprovalService.ORIGINAL_UNAVAILABLE_MESSAGE);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowValidation_WhenNoteIsTooLong()
    {
        var (mariaManual, _) = Scenario();

        var act = () => _sut.ApproveAsync(COMPANY, ANA_USER, mariaManual.PunchId, new ReviewInsertInfo { Note = new string('x', 501) });

        (await act.Should().ThrowAsync<ValidationException>()).Which.Errors.Should().ContainSingle(e => e.Field == "note");
    }

    [Fact]
    public async Task ApproveAsync_ShouldThrowNotFound_WhenPunchDoesNotExist()
    {
        var act = () => _sut.ApproveAsync(COMPANY, ANA_USER, 999_999, null);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
