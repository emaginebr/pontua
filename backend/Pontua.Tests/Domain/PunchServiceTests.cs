using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Common;
using Pontua.DTO.Punches;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

/// <summary>Testes de <see cref="PunchService"/> (marcação normal e offline, histórico) e do resumo de horas.</summary>
public class PunchServiceTests
{
    /// <summary>Quarta-feira, 25/11/2026 08:02:41 em São Paulo (UTC−3).</summary>
    private static readonly DateTime WEDNESDAY_0802 = new(2026, 11, 25, 11, 2, 41, DateTimeKind.Utc);

    private static readonly DateOnly WEDNESDAY = new(2026, 11, 25);

    private const long COMPANY = 3;
    private const long OWNER_USER = 7;
    private const long INACTIVE_USER = 10;
    private const long OTHER_USER = 11;
    private const long MEMBER = 12;
    private const long OTHER_MEMBER = 16;
    private const long POSITION = 40;

    private readonly Mock<IPunchRepository<Punch, PunchStatusChange>> _punches = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<IScheduleRepository<Schedule>> _schedules = new();
    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<INsrAllocator> _nsr = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ICompanyAccessPolicy> _access = new();
    private readonly Mock<IClock> _clock = new();

    private readonly List<Member> _memberStore = new()
    {
        new() { MemberId = MEMBER, CompanyId = COMPANY, UserId = OWNER_USER, ActiveSince = new DateOnly(2026, 1, 1) },
        new() { MemberId = OTHER_MEMBER, CompanyId = COMPANY, UserId = OTHER_USER, ActiveSince = new DateOnly(2026, 1, 1) }
    };

    private readonly List<Punch> _store = new();
    private readonly List<PunchStatusChange> _changes = new();
    private long _lastNsr;
    private DateTime _now = WEDNESDAY_0802;

    private readonly PunchService _sut;

    public PunchServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(() => _now);
        _companies.Setup(r => r.GetByIdAsync(COMPANY)).ReturnsAsync(new Company
        {
            CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = OWNER_USER,
            TimeZone = "America/Sao_Paulo", ManualRetroDays = 30
        });

        var ownerContext = new AccessContext
        {
            CompanyId = COMPANY, UserId = OWNER_USER, MemberId = MEMBER, IsActive = true, IsOwner = true
        };
        var otherContext = new AccessContext
        {
            CompanyId = COMPANY, UserId = OTHER_USER, MemberId = OTHER_MEMBER, IsActive = true
        };
        _access.Setup(a => a.RequireMemberAsync(COMPANY, OWNER_USER)).ReturnsAsync(ownerContext);
        _access.Setup(a => a.RequireMemberAsync(COMPANY, OTHER_USER)).ReturnsAsync(otherContext);
        _access.Setup(a => a.RequireMemberAsync(COMPANY, INACTIVE_USER))
            .ThrowsAsync(new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE));
        _access.Setup(a => a.RequireCanSuperviseAsync(otherContext, MEMBER, It.IsAny<DateOnly>()))
            .ThrowsAsync(new ForbiddenException("Você não supervisiona este membro."));

        // Jornada padrão do cargo (seg–sex; Entrada 08:00, Pausa 12:00, Retorno 13:00, Saída 17:00; 480/2400 min).
        var schedule = ScheduleFactory.Create(ScheduleFactory.DefaultWeekly(), COMPANY, POSITION, null,
            new DateOnly(2026, 1, 1), OWNER_USER, WEDNESDAY_0802);
        schedule.ScheduleId = 90;
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Select(id => new MemberPosition
            {
                MemberId = id, PositionId = POSITION, EffectiveFrom = new DateOnly(2026, 1, 1)
            }).ToList());
        _members.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _memberStore.FirstOrDefault(m => m.MemberId == id));
        _schedules.Setup(r => r.ListByMembersAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>());
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule> { schedule });

        _nsr.Setup(n => n.NextAsync(COMPANY)).ReturnsAsync(() => ++_lastNsr);
        _punches.Setup(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()))
            .ReturnsAsync((Punch p, PunchStatusChange change) =>
            {
                SetPunchId(p, 1000 + _store.Count);
                change.PunchId = p.PunchId;
                _store.Add(p);
                _changes.Add(change);
                return p;
            });
        _punches.Setup(r => r.ListByMemberAsync(It.IsAny<long>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long memberId, DateOnly start, DateOnly end) => _store
                .Where(p => p.MemberId == memberId && p.WorkDate >= start && p.WorkDate <= end)
                .OrderBy(p => p.PunchedAt)
                .ToList());
        _punches.Setup(r => r.GetLastAutomaticPunchedAtAsync(It.IsAny<long>()))
            .ReturnsAsync((long memberId) => _store
                .Where(p => p.MemberId == memberId && p.Kind is PunchKind.Normal or PunchKind.Offline)
                .Select(p => (DateTime?)p.PunchedAt)
                .Max());
        _punches.Setup(r => r.GetByClientIdAsync(It.IsAny<long>(), It.IsAny<Guid>()))
            .ReturnsAsync((long memberId, Guid clientId) => _store.FirstOrDefault(p => p.MemberId == memberId && p.ClientId == clientId));
        _punches.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _store.FirstOrDefault(p => p.PunchId == id));
        _punches.Setup(r => r.ListStatusHistoryAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _changes.Where(c => c.PunchId == id).ToList());
        _users.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync(new List<User> { new() { UserId = OWNER_USER, Name = "Ana Silva" } });

        _sut = new PunchService(
            _punches.Object,
            _members.Object,
            _schedules.Object,
            _companies.Object,
            _users.Object,
            _nsr.Object,
            _unitOfWork.Object,
            _access.Object,
            new ScheduleResolver(),
            new CompanyClock(_clock.Object),
            _clock.Object,
            new OfflinePunchBatchInfoValidator(),
            new ManualPunchInsertInfoValidator(),
            NullLogger<PunchService>.Instance);
    }

    private static void SetPunchId(Punch punch, long id) =>
        typeof(Punch).GetProperty(nameof(Punch.PunchId))!.SetValue(punch, id);

    /// <summary>Marcação já gravada do membro, no horário local informado.</summary>
    private Punch AddPunch(DateOnly date, int hour, int minute, PunchKind kind = PunchKind.Normal,
        PunchStatus status = PunchStatus.Valid, Guid? clientId = null)
    {
        var punchedAt = new CompanyClock(_clock.Object).ToUtc(date, new TimeOnly(hour, minute), "America/Sao_Paulo");
        var punch = Punch.Create(COMPANY, MEMBER, ++_lastNsr, kind, punchedAt, date, punchedAt, status,
            status == PunchStatus.Pending ? PendingReason.Offline : null, OWNER_USER, clientId: clientId);
        SetPunchId(punch, 500 + _store.Count);
        _store.Add(punch);
        return punch;
    }

    private static OfflinePunchBatchInfo Batch(params (Guid ClientId, string PunchedAt)[] items) => new()
    {
        Items = items.Select(i => new OfflinePunchItem { ClientId = i.ClientId.ToString(), PunchedAt = i.PunchedAt }).ToList()
    };

    // ---------- Marcação normal ----------

    [Fact]
    public async Task PunchAsync_ShouldBeValidAndAssociatedToFirstPeriod_WhenWorkDay()
    {
        var info = await _sut.PunchAsync(COMPANY, OWNER_USER);

        info.Kind.Should().Be("normal");
        info.Status.Should().Be("valid");
        info.PendingReason.Should().BeNull();
        info.PeriodName.Should().Be("Entrada");
        info.Nsr.Should().Be(1);
        info.PunchedAt.Should().Be(WEDNESDAY_0802);
        info.ReceivedAt.Should().Be(WEDNESDAY_0802);
        info.WorkDate.Should().Be(WEDNESDAY);
        info.LocalTime.Should().Be(new TimeOnly(8, 2));
        info.CountsAsWorked.Should().BeTrue();

        _changes.Should().ContainSingle(c => c.FromStatus == null && c.ToStatus == PunchStatus.Valid && c.PunchId == info.PunchId);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task PunchAsync_ShouldBePendingOutsideWorkday_WhenDayIsNotWorkDay()
    {
        _now = new DateTime(2026, 11, 28, 12, 0, 0, DateTimeKind.Utc); // sábado, 09:00 local

        var info = await _sut.PunchAsync(COMPANY, OWNER_USER);

        info.Status.Should().Be("pending");
        info.PendingReason.Should().Be("outsideWorkday");
        info.WorkDate.Should().Be(new DateOnly(2026, 11, 28));
        info.PeriodName.Should().BeNull("dia não útil não tem períodos previstos");
        info.CountsAsWorked.Should().BeFalse();
    }

    [Fact]
    public async Task PunchAsync_ShouldUseLocalDate_WhenUtcIsAlreadyNextDay()
    {
        _now = new DateTime(2026, 11, 26, 1, 30, 0, DateTimeKind.Utc); // 25/11 22:30 local

        var info = await _sut.PunchAsync(COMPANY, OWNER_USER);

        info.WorkDate.Should().Be(WEDNESDAY);
        info.LocalTime.Should().Be(new TimeOnly(22, 30));
    }

    [Fact]
    public async Task PunchAsync_ShouldRefuseAndRollback_WhenLastAutomaticPunchWasLessThan60SecondsAgo()
    {
        _store.Add(CreateAt(WEDNESDAY_0802.AddSeconds(-59), PunchKind.Offline));

        var act = () => _sut.PunchAsync(COMPANY, OWNER_USER);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(PunchService.TOO_SOON_MESSAGE);
        _punches.Verify(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()), Times.Never);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task PunchAsync_ShouldAccept_WhenLastAutomaticPunchWasExactly60SecondsAgo()
    {
        _store.Add(CreateAt(WEDNESDAY_0802.AddSeconds(-60), PunchKind.Normal));

        var info = await _sut.PunchAsync(COMPANY, OWNER_USER);

        info.Status.Should().Be("valid");
    }

    [Fact]
    public async Task PunchAsync_ShouldIgnoreManualPunches_WhenApplyingThe60SecondRule()
    {
        var manual = Punch.Create(COMPANY, MEMBER, ++_lastNsr, PunchKind.Manual, WEDNESDAY_0802.AddSeconds(-10), WEDNESDAY,
            WEDNESDAY_0802.AddSeconds(-10), PunchStatus.Pending, PendingReason.Manual, OWNER_USER, justification: "Esqueci");
        SetPunchId(manual, 400);
        _store.Add(manual);

        var act = () => _sut.PunchAsync(COMPANY, OWNER_USER);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task PunchAsync_ShouldAssociateNextPeriodAndThenExtra_WhenDayAlreadyHasPunches()
    {
        AddPunch(WEDNESDAY, 8, 0);
        AddPunch(WEDNESDAY, 12, 0);
        _now = new CompanyClock(_clock.Object).ToUtc(WEDNESDAY, new TimeOnly(13, 1), "America/Sao_Paulo");

        var third = await _sut.PunchAsync(COMPANY, OWNER_USER);
        AddPunch(WEDNESDAY, 17, 0);
        _now = new CompanyClock(_clock.Object).ToUtc(WEDNESDAY, new TimeOnly(18, 0), "America/Sao_Paulo");
        var fifth = await _sut.PunchAsync(COMPANY, OWNER_USER);

        third.PeriodName.Should().Be("Retorno");
        fifth.PeriodName.Should().BeNull("marcações além dos períodos previstos são extras");
    }

    [Fact]
    public async Task PunchAsync_ShouldThrowNotFound_WhenMemberIsInactiveOrNotLinked()
    {
        var act = () => _sut.PunchAsync(COMPANY, INACTIVE_USER);

        await act.Should().ThrowAsync<NotFoundException>();
        _nsr.Verify(n => n.NextAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task PunchAsync_ShouldGenerateSequentialNsr_WhenPunchesFollowEachOther()
    {
        var first = await _sut.PunchAsync(COMPANY, OWNER_USER);
        _now = _now.AddMinutes(5);
        var second = await _sut.PunchAsync(COMPANY, OWNER_USER);

        second.Nsr.Should().Be(first.Nsr + 1);
    }

    private Punch CreateAt(DateTime punchedAtUtc, PunchKind kind)
    {
        var punch = Punch.Create(COMPANY, MEMBER, ++_lastNsr, kind, punchedAtUtc, WEDNESDAY, punchedAtUtc,
            kind == PunchKind.Offline ? PunchStatus.Pending : PunchStatus.Valid,
            kind == PunchKind.Offline ? PendingReason.Offline : null, OWNER_USER,
            clientId: kind == PunchKind.Offline ? Guid.NewGuid() : null);
        SetPunchId(punch, 300 + _store.Count);
        return punch;
    }

    // ---------- Marcação offline ----------

    [Fact]
    public async Task SyncOfflineAsync_ShouldCreatePendingOfflinePunchWithDeviceTime()
    {
        var clientId = Guid.NewGuid();

        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch((clientId, "2026-11-25T07:58:10-03:00")));

        var item = result.Items.Should().ContainSingle().Subject;
        item.ClientId.Should().Be(clientId.ToString());
        item.Result.Should().Be(OfflineSyncItemResult.CREATED);
        item.Punch!.Kind.Should().Be("offline");
        item.Punch.Status.Should().Be("pending");
        item.Punch.PendingReason.Should().Be("offline");
        item.Punch.PunchedAt.Should().Be(new DateTime(2026, 11, 25, 10, 58, 10, DateTimeKind.Utc));
        item.Punch.ReceivedAt.Should().Be(WEDNESDAY_0802);
        item.Punch.LocalTime.Should().Be(new TimeOnly(7, 58));
        item.Punch.PeriodName.Should().Be("Entrada", "pendentes são efetivas e entram na associação a períodos");
        _store.Single().ClientId.Should().Be(clientId);
        _changes.Should().ContainSingle(c => c.FromStatus == null && c.ToStatus == PunchStatus.Pending);
    }

    [Fact]
    public async Task SyncOfflineAsync_ShouldReturnExistingPunchAsDuplicate_WhenClientIdWasAlreadyReceived()
    {
        var clientId = Guid.NewGuid();
        var existing = AddPunch(WEDNESDAY, 7, 58, PunchKind.Offline, PunchStatus.Pending, clientId);

        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch((clientId, "2026-11-25T07:58:00-03:00")));

        var item = result.Items.Single();
        item.Result.Should().Be(OfflineSyncItemResult.DUPLICATE);
        item.Punch!.PunchId.Should().Be(existing.PunchId);
        _punches.Verify(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()), Times.Never);
        _nsr.Verify(n => n.NextAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task SyncOfflineAsync_ShouldReturnDuplicate_WhenConcurrentResendViolatesUniqueIndex()
    {
        var clientId = Guid.NewGuid();
        var winner = CreateAt(WEDNESDAY_0802.AddMinutes(-5), PunchKind.Offline);
        _punches.SetupSequence(r => r.GetByClientIdAsync(MEMBER, clientId))
            .ReturnsAsync((Punch?)null)  // antes da transação
            .ReturnsAsync((Punch?)null)  // depois do lock
            .ReturnsAsync(winner);       // depois da violação do índice
        _punches.Setup(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()))
            .ThrowsAsync(new UniqueConstraintViolationException("ix_punches_member_client"));

        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch((clientId, "2026-11-25T07:57:41-03:00")));

        result.Items.Single().Result.Should().Be(OfflineSyncItemResult.DUPLICATE);
        result.Items.Single().Punch!.PunchId.Should().Be(winner.PunchId);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Theory]
    [InlineData("2026-11-25T11:05:42Z", OfflineSyncItemResult.FUTURE)]   // agora + 3 min 1 s
    [InlineData("2026-11-25T08:04:41-03:00", OfflineSyncItemResult.CREATED)] // agora + 2 min (tolerância)
    public async Task SyncOfflineAsync_ShouldRefuseFuture_WhenBeyondTwoMinuteTolerance(string punchedAt, string expected)
    {
        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch((Guid.NewGuid(), punchedAt)));

        result.Items.Single().Result.Should().Be(expected);
        if (expected == OfflineSyncItemResult.FUTURE)
        {
            result.Items.Single().Punch.Should().BeNull();
            _store.Should().BeEmpty();
        }
    }

    [Theory]
    [InlineData("2026-10-25T23:59:00-03:00", OfflineSyncItemResult.TOO_OLD)] // antes de hoje − 30 dias
    [InlineData("2026-10-26T00:01:00-03:00", OfflineSyncItemResult.CREATED)] // exatamente no limite
    public async Task SyncOfflineAsync_ShouldRefuseTooOld_WhenBeforeRetroactiveLimit(string punchedAt, string expected)
    {
        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch((Guid.NewGuid(), punchedAt)));

        result.Items.Single().Result.Should().Be(expected);
    }

    [Fact]
    public async Task SyncOfflineAsync_ShouldReturnResultPerItemInBatchOrder()
    {
        var duplicateId = Guid.NewGuid();
        AddPunch(new DateOnly(2026, 11, 24), 8, 0, PunchKind.Offline, PunchStatus.Pending, duplicateId);

        var result = await _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch(
            (Guid.NewGuid(), "2026-11-24T12:00:00-03:00"),
            (duplicateId, "2026-11-24T08:00:00-03:00"),
            (Guid.NewGuid(), "2026-12-25T08:00:00-03:00"),
            (Guid.NewGuid(), "2026-01-05T08:00:00-03:00")));

        result.Items.Select(i => i.Result).Should().Equal(
            OfflineSyncItemResult.CREATED, OfflineSyncItemResult.DUPLICATE, OfflineSyncItemResult.FUTURE, OfflineSyncItemResult.TOO_OLD);
        result.Items[0].Punch!.PeriodName.Should().Be("Pausa", "a 08:00 do mesmo dia já ocupa a Entrada");
    }

    [Fact]
    public async Task SyncOfflineAsync_ShouldThrowNotFound_WhenMemberIsInactive()
    {
        var act = () => _sut.SyncOfflineAsync(COMPANY, INACTIVE_USER, Batch((Guid.NewGuid(), "2026-11-25T08:00:00-03:00")));

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task OfflinePunchBatchInfoValidator_ShouldReject_WhenBatchIsEmptyOrTooLarge()
    {
        var validator = new OfflinePunchBatchInfoValidator();
        var tooLarge = Batch(Enumerable.Range(0, 51).Select(_ => (Guid.NewGuid(), "2026-11-25T08:00:00Z")).ToArray());

        (await validator.ValidateAsync(new OfflinePunchBatchInfo())).IsValid.Should().BeFalse();
        (await validator.ValidateAsync(new OfflinePunchBatchInfo { Items = new List<OfflinePunchItem>() })).IsValid.Should().BeFalse();
        (await validator.ValidateAsync(tooLarge)).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("8f1c2a5e-0000-4000-8000-000000000001", "2026-11-25T08:00:00", false)]      // sem offset
    [InlineData("8f1c2a5e-0000-4000-8000-000000000001", "25/11/2026 08:00", false)]          // não ISO
    [InlineData("", "2026-11-25T08:00:00Z", false)]                                           // clientId vazio
    [InlineData("abc", "2026-11-25T08:00:00Z", false)]                                        // não uuid
    [InlineData("8f1c2a5e-0000-4000-8000-000000000001", "2026-11-25T08:00:00.123-03:00", true)]
    [InlineData("8f1c2a5e-0000-4000-8000-000000000001", "2026-11-25T11:00:00Z", true)]
    public async Task OfflinePunchBatchInfoValidator_ShouldValidateItemFormat(string clientId, string punchedAt, bool valid)
    {
        var batch = new OfflinePunchBatchInfo
        {
            Items = new List<OfflinePunchItem> { new() { ClientId = clientId, PunchedAt = punchedAt } }
        };

        (await new OfflinePunchBatchInfoValidator().ValidateAsync(batch)).IsValid.Should().Be(valid);
    }

    [Fact]
    public async Task SyncOfflineAsync_ShouldRejectBatch_WhenClientIdIsRepeated()
    {
        var clientId = Guid.NewGuid();

        var act = () => _sut.SyncOfflineAsync(COMPANY, OWNER_USER, Batch(
            (clientId, "2026-11-25T08:00:00-03:00"),
            (clientId, "2026-11-25T08:01:00-03:00")));

        await act.Should().ThrowAsync<ValidationException>();
        _store.Should().BeEmpty();
    }

    // ---------- Histórico ----------

    [Fact]
    public async Task GetMyDaysAsync_ShouldReturnEveryDayOfRange_IncludingDaysWithoutPunches()
    {
        AddPunch(WEDNESDAY, 8, 0);
        AddPunch(WEDNESDAY, 12, 0);
        AddPunch(WEDNESDAY, 13, 0);
        AddPunch(WEDNESDAY, 17, 0);

        var days = await _sut.GetMyDaysAsync(COMPANY, OWNER_USER, new DateRangeQuery { Month = "2026-11" });

        days.Should().HaveCount(30);
        days.Select(d => d.Date).Should().BeInAscendingOrder();
        var wednesday = days.Single(d => d.Date == WEDNESDAY);
        wednesday.Periods.Select(p => p.Name).Should().Equal("Entrada", "Pausa", "Retorno", "Saída");
        wednesday.Periods.Should().OnlyContain(p => p.PunchId != null);
        wednesday.WorkedMinutes.Should().Be(480);
        wednesday.ExpectedMinutes.Should().Be(480);
        wednesday.BalanceMinutes.Should().Be(0);
        wednesday.Punches.Select(p => p.PeriodName).Should().Equal("Entrada", "Pausa", "Retorno", "Saída");

        var saturday = days.Single(d => d.Date == new DateOnly(2026, 11, 28));
        saturday.IsWorkDay.Should().BeFalse();
        saturday.Punches.Should().BeEmpty();
        var thursday = days.Single(d => d.Date == new DateOnly(2026, 11, 26));
        thursday.IsWorkDay.Should().BeTrue();
        thursday.Punches.Should().BeEmpty();
        thursday.Periods.Should().HaveCount(4).And.OnlyContain(p => p.PunchId == null);
    }

    [Fact]
    public async Task GetDaysAsync_ShouldThrowForbidden_WhenCallerCannotSuperviseTheMember()
    {
        var act = () => _sut.GetDaysAsync(COMPANY, OTHER_USER, MEMBER, null);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task GetPunchAsync_ShouldIncludeStatusHistory()
    {
        var created = await _sut.PunchAsync(COMPANY, OWNER_USER);

        var info = await _sut.GetPunchAsync(COMPANY, OWNER_USER, created.PunchId);

        info.PeriodName.Should().Be("Entrada");
        info.StatusHistory.Should().ContainSingle().Which.Should().Match<PunchStatusChangeInfo>(c =>
            c.FromStatus == null && c.ToStatus == "valid" && c.ChangedBy == "Ana Silva");
    }

    [Fact]
    public async Task GetPunchAsync_ShouldThrowNotFound_WhenPunchDoesNotExist()
    {
        var act = () => _sut.GetPunchAsync(COMPANY, OWNER_USER, 999_999);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    // ---------- Resumo de horas ----------

    [Fact]
    public async Task SummaryService_ShouldSumWorkedAndExpectedByWeekAndCountPending()
    {
        AddPunch(WEDNESDAY, 8, 0);
        AddPunch(WEDNESDAY, 12, 0);
        AddPunch(WEDNESDAY, 13, 0);
        AddPunch(WEDNESDAY, 17, 30);
        AddPunch(new DateOnly(2026, 11, 26), 8, 0, PunchKind.Offline, PunchStatus.Pending, Guid.NewGuid());
        var summaryService = new SummaryService(_punches.Object, _members.Object, _schedules.Object, _companies.Object,
            _access.Object, new ScheduleResolver(), new CompanyClock(_clock.Object));

        var summary = await summaryService.GetMySummaryAsync(COMPANY, OWNER_USER,
            new DateRangeQuery { Start = "2026-11-23", End = "2026-11-29" });

        // Hoje é quarta: a semana ainda não terminou, então o previsto é a soma de seg, ter e qua (R-09, atualização).
        summary.Weeks.Should().ContainSingle().Which.Partial.Should().BeFalse();
        summary.Weeks[0].ExpectedMinutes.Should().Be(3 * 480);
        summary.Totals.WorkedMinutes.Should().Be(510);
        summary.Totals.ExpectedMinutes.Should().Be(3 * 480);
        summary.Totals.BalanceMinutes.Should().Be(510 - 3 * 480);
        summary.Totals.PendingPunches.Should().Be(1);
        summary.Days.Should().HaveCount(7);
        summary.Days.Single(d => d.Date == WEDNESDAY).BalanceMinutes.Should().Be(30);
        summary.Days.Single(d => d.Date == new DateOnly(2026, 11, 26)).ExpectedMinutes.Should().Be(0, "quinta ainda não chegou");
        summary.Days.Single(d => d.Date == new DateOnly(2026, 11, 26)).IsWorkDay.Should().BeTrue();
    }

    private SummaryService CreateSummaryService() =>
        new(_punches.Object, _members.Object, _schedules.Object, _companies.Object,
            _access.Object, new ScheduleResolver(), new CompanyClock(_clock.Object));

    [Fact]
    public async Task SummaryService_ShouldUseWeeklyLoad_WhenWholeWeekIsPastAndMemberWasActiveEveryDay()
    {
        var summary = await CreateSummaryService().GetMySummaryAsync(COMPANY, OWNER_USER,
            new DateRangeQuery { Start = "2026-11-16", End = "2026-11-22" });

        summary.Weeks.Should().ContainSingle().Which.ExpectedMinutes.Should().Be(2400);
        summary.Totals.ExpectedMinutes.Should().Be(2400);
    }

    [Fact]
    public async Task SummaryService_ShouldIgnoreDaysBeforeActiveSince_WhenMemberJoinedMidWeek()
    {
        _memberStore.Single(m => m.MemberId == MEMBER).ActiveSince = new DateOnly(2026, 11, 18); // quarta

        var summary = await CreateSummaryService().GetMySummaryAsync(COMPANY, OWNER_USER,
            new DateRangeQuery { Start = "2026-11-16", End = "2026-11-22" });

        summary.Weeks.Single().ExpectedMinutes.Should().Be(3 * 480, "só quarta, quinta e sexta contam");
        summary.Days.Where(d => d.Date < new DateOnly(2026, 11, 18)).Should().OnlyContain(d => d.ExpectedMinutes == 0);
        summary.Days.Single(d => d.Date == new DateOnly(2026, 11, 18)).ExpectedMinutes.Should().Be(480);
    }

    [Fact]
    public async Task SummaryService_ShouldIgnoreDaysFromDeactivationOn_WhenMemberWasDeactivated()
    {
        // Desativado em 19/11 às 18:00 local (21:00 UTC): conta seg, ter e qua (16 a 18).
        _memberStore.Single(m => m.MemberId == MEMBER).DeactivatedAt = new DateTime(2026, 11, 19, 21, 0, 0, DateTimeKind.Utc);

        var summary = await CreateSummaryService().GetSummaryAsync(COMPANY, OWNER_USER, MEMBER,
            new DateRangeQuery { Start = "2026-11-16", End = "2026-11-22" });

        summary.Weeks.Single().ExpectedMinutes.Should().Be(3 * 480);
        summary.Days.Single(d => d.Date == new DateOnly(2026, 11, 19)).ExpectedMinutes.Should().Be(0);
    }

    [Fact]
    public async Task GetMyDaysAsync_ShouldReturnZeroExpected_ForFutureDaysAndDaysBeforeActiveSince()
    {
        _memberStore.Single(m => m.MemberId == MEMBER).ActiveSince = new DateOnly(2026, 11, 10);

        var days = await _sut.GetMyDaysAsync(COMPANY, OWNER_USER, new DateRangeQuery { Month = "2026-11" });

        days.Single(d => d.Date == new DateOnly(2026, 11, 9)).ExpectedMinutes.Should().Be(0, "antes de active_since");
        days.Single(d => d.Date == new DateOnly(2026, 11, 10)).ExpectedMinutes.Should().Be(480);
        days.Single(d => d.Date == WEDNESDAY).ExpectedMinutes.Should().Be(480, "hoje conta");
        var thursday = days.Single(d => d.Date == new DateOnly(2026, 11, 26));
        thursday.ExpectedMinutes.Should().Be(0, "dias futuros não têm previsto");
        thursday.BalanceMinutes.Should().Be(0);
        thursday.IsWorkDay.Should().BeTrue("o calendário continua mostrando o dia útil");
    }
}
