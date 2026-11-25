using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Punches;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

/// <summary>Marcações manuais e cancelamento (US5: FR-018 a FR-020, R-11).</summary>
public class ManualPunchTests
{
    /// <summary>Quarta-feira, 25/11/2026 08:02:41 em São Paulo (UTC−3).</summary>
    private static readonly DateTime NOW = new(2026, 11, 25, 11, 2, 41, DateTimeKind.Utc);

    private static readonly DateOnly TODAY = new(2026, 11, 25);
    private static readonly DateOnly YESTERDAY = TODAY.AddDays(-1);
    private const string TIME_ZONE = "America/Sao_Paulo";

    private const long COMPANY = 3;
    private const long JOAO_USER = 8;
    private const long MARIA_USER = 9;
    private const long JOAO = 15;
    private const long MARIA = 16;
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

    private readonly List<Punch> _store = new();
    private readonly List<PunchStatusChange> _changes = new();
    private readonly List<string> _calls = new();
    private readonly CompanyClock _companyClock;
    private long _lastNsr;

    private readonly PunchService _sut;

    public ManualPunchTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _companyClock = new CompanyClock(_clock.Object);
        _companies.Setup(r => r.GetByIdAsync(COMPANY)).ReturnsAsync(new Company
        {
            CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = 7, TimeZone = TIME_ZONE, ManualRetroDays = 30
        });

        _access.Setup(a => a.RequireMemberAsync(COMPANY, JOAO_USER)).ReturnsAsync(new AccessContext
        {
            CompanyId = COMPANY, UserId = JOAO_USER, MemberId = JOAO, IsActive = true
        });
        _access.Setup(a => a.RequireMemberAsync(COMPANY, MARIA_USER)).ReturnsAsync(new AccessContext
        {
            CompanyId = COMPANY, UserId = MARIA_USER, MemberId = MARIA, IsActive = true
        });

        var schedule = ScheduleFactory.Create(ScheduleFactory.DefaultWeekly(), COMPANY, POSITION, null,
            new DateOnly(2026, 1, 1), 7, NOW);
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => ids.Select(id => new MemberPosition
            {
                MemberId = id, PositionId = POSITION, EffectiveFrom = new DateOnly(2026, 1, 1)
            }).ToList());
        _schedules.Setup(r => r.ListByMembersAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>());
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule> { schedule });

        _nsr.Setup(n => n.NextAsync(COMPANY)).ReturnsAsync(() =>
        {
            _calls.Add("nsr");
            return ++_lastNsr;
        });
        _unitOfWork.Setup(u => u.BeginTransactionAsync()).Callback(() => _calls.Add("begin")).Returns(Task.CompletedTask);
        _unitOfWork.Setup(u => u.CommitAsync()).Callback(() => _calls.Add("commit")).Returns(Task.CompletedTask);
        _unitOfWork.Setup(u => u.RollbackAsync()).Callback(() => _calls.Add("rollback")).Returns(Task.CompletedTask);

        _punches.Setup(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()))
            .ReturnsAsync((Punch p, PunchStatusChange change) =>
            {
                _calls.Add("insert");
                SetPunchId(p, 1000 + _store.Count);
                change.PunchId = p.PunchId;
                _store.Add(p);
                _changes.Add(change);
                return p;
            });
        _punches.Setup(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()))
            .ReturnsAsync((Punch p, PunchStatusChange change) =>
            {
                _calls.Add($"status:{p.PunchId}:{change.ToStatus}");
                change.PunchId = p.PunchId;
                _changes.Add(change);
                return true;
            });
        _punches.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _store.FirstOrDefault(p => p.PunchId == id));
        _punches.Setup(r => r.ListPendingCorrectionsAsync(It.IsAny<long>()))
            .ReturnsAsync((long originalId) => _store
                .Where(p => p.ReplacesPunchId == originalId && p.Status == PunchStatus.Pending).ToList());
        _punches.Setup(r => r.ListByMemberAsync(It.IsAny<long>(), It.IsAny<DateOnly>(), It.IsAny<DateOnly>()))
            .ReturnsAsync((long memberId, DateOnly start, DateOnly end) => _store
                .Where(p => p.MemberId == memberId && p.WorkDate >= start && p.WorkDate <= end)
                .OrderBy(p => p.PunchedAt).ToList());

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
            _companyClock,
            _clock.Object,
            new OfflinePunchBatchInfoValidator(),
            new ManualPunchInsertInfoValidator(),
            NullLogger<PunchService>.Instance);
    }

    private static void SetPunchId(Punch punch, long id) =>
        typeof(Punch).GetProperty(nameof(Punch.PunchId))!.SetValue(punch, id);

    /// <summary>Marcação já gravada, no horário local informado.</summary>
    private Punch AddPunch(long memberId, DateOnly date, int hour, int minute, PunchStatus status = PunchStatus.Valid,
        PunchKind kind = PunchKind.Normal, long? replaces = null, long createdBy = JOAO_USER)
    {
        var punchedAt = _companyClock.ToUtc(date, new TimeOnly(hour, minute), TIME_ZONE);
        var initial = status is PunchStatus.Valid or PunchStatus.Superseded ? PunchStatus.Valid : PunchStatus.Pending;
        var punch = Punch.Create(COMPANY, memberId, ++_lastNsr, kind, punchedAt, date, punchedAt, initial,
            initial == PunchStatus.Pending
                ? kind switch { PunchKind.Manual => PendingReason.Manual, PunchKind.Offline => PendingReason.Offline, _ => PendingReason.OutsideWorkday }
                : null,
            createdBy, justification: kind == PunchKind.Manual ? "Esqueci de marcar" : null, replacesPunchId: replaces,
            clientId: kind == PunchKind.Offline ? Guid.NewGuid() : null);
        if (status != initial)
            punch.ChangeStatus(status, 7, null, NOW.AddDays(-1));
        SetPunchId(punch, 500 + _store.Count);
        _store.Add(punch);
        return punch;
    }

    private static ManualPunchInsertInfo Manual(DateOnly date, string time, string? justification = "Esqueci de marcar a saída",
        long? replaces = null) => new()
    {
        WorkDate = date,
        Time = TimeOnly.Parse(time),
        Justification = justification,
        ReplacesPunchId = replaces
    };

    // ---------- Inclusão ----------

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task CreateManualAsync_ShouldThrowValidation_WhenJustificationIsMissing(string? justification)
    {
        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "17:00", justification));

        var error = await act.Should().ThrowAsync<ValidationException>();
        error.Which.Message.Should().Be(ManualPunchInsertInfoValidator.JUSTIFICATION_REQUIRED_MESSAGE);
        error.Which.Errors.Should().ContainSingle(e => e.Field == "justification");
        _store.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateManualAsync_ShouldThrowValidation_WhenJustificationIsTooShortOrDateMissing()
    {
        var shortJustification = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "17:00", "ok"));
        var noDate = () => _sut.CreateManualAsync(COMPANY, JOAO_USER,
            new ManualPunchInsertInfo { Time = new TimeOnly(17, 0), Justification = "Esqueci de marcar" });

        (await shortJustification.Should().ThrowAsync<ValidationException>()).Which.Errors
            .Should().ContainSingle(e => e.Field == "justification");
        (await noDate.Should().ThrowAsync<ValidationException>()).Which.Errors
            .Should().ContainSingle(e => e.Field == "workDate");
    }

    [Fact]
    public async Task CreateManualAsync_ShouldCreatePendingManualPunch_WhenYesterdayWithJustification()
    {
        var info = await _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "17:00"));

        info.Kind.Should().Be("manual");
        info.Status.Should().Be("pending");
        info.PendingReason.Should().Be("manual");
        info.CountsAsWorked.Should().BeFalse("só conta depois de aprovada");
        info.WorkDate.Should().Be(YESTERDAY);
        info.LocalTime.Should().Be(new TimeOnly(17, 0));
        info.PunchedAt.Should().Be(new DateTime(2026, 11, 24, 20, 0, 0, DateTimeKind.Utc), "17:00 em São Paulo = 20:00 UTC");
        info.ReceivedAt.Should().Be(NOW);
        info.Justification.Should().Be("Esqueci de marcar a saída");
        info.Nsr.Should().Be(1);
        info.ReplacesPunchId.Should().BeNull();

        _changes.Should().ContainSingle(c => c.FromStatus == null && c.ToStatus == PunchStatus.Pending && c.ChangedByUserId == JOAO_USER);
        _calls.Should().Equal("begin", "nsr", "insert", "commit");
    }

    [Fact]
    public async Task CreateManualAsync_ShouldThrowBusinessRule_WhenInstantIsInTheFuture()
    {
        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(TODAY, "08:03"));

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(PunchService.MANUAL_FUTURE_MESSAGE);
        _nsr.Verify(n => n.NextAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task CreateManualAsync_ShouldAccept_WhenInstantIsEarlierToday()
    {
        var info = await _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(TODAY, "08:02"));

        info.WorkDate.Should().Be(TODAY);
    }

    [Fact]
    public async Task CreateManualAsync_ShouldThrowBusinessRule_WhenDateIsBeforeRetroactiveLimit()
    {
        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(TODAY.AddDays(-31), "08:00"));

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*limite retroativo*30 dias*");
        _store.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateManualAsync_ShouldAccept_WhenDateIsExactlyAtRetroactiveLimit()
    {
        var info = await _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(TODAY.AddDays(-30), "08:00"));

        info.WorkDate.Should().Be(TODAY.AddDays(-30));
    }

    // ---------- Correção ----------

    [Fact]
    public async Task CreateManualAsync_ShouldThrowConflict_WhenReplacedPunchBelongsToAnotherMember()
    {
        var other = AddPunch(MARIA, YESTERDAY, 8, 0, createdBy: MARIA_USER);

        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:05", replaces: other.PunchId));

        await act.Should().ThrowAsync<ConflictException>().WithMessage(PunchService.REPLACED_NOT_OWN_MESSAGE);
        _nsr.Verify(n => n.NextAsync(It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData(PunchStatus.Pending)]
    [InlineData(PunchStatus.Rejected)]
    [InlineData(PunchStatus.Superseded)]
    public async Task CreateManualAsync_ShouldThrowConflict_WhenReplacedPunchIsNotValidOrApproved(PunchStatus status)
    {
        var original = AddPunch(JOAO, YESTERDAY, 8, 0, status);

        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:05", replaces: original.PunchId));

        await act.Should().ThrowAsync<ConflictException>().WithMessage(PunchService.REPLACED_NOT_CORRECTABLE_MESSAGE);
    }

    [Fact]
    public async Task CreateManualAsync_ShouldThrowNotFound_WhenReplacedPunchDoesNotExist()
    {
        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:05", replaces: 999_999));

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task CreateManualAsync_ShouldCreateCorrectionReferencingOriginal_WhenOriginalIsApproved()
    {
        var original = AddPunch(JOAO, YESTERDAY, 8, 30, PunchStatus.Approved, PunchKind.Offline);

        var info = await _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:00", replaces: original.PunchId));

        info.ReplacesPunchId.Should().Be(original.PunchId);
        info.Status.Should().Be("pending");
        original.Status.Should().Be(PunchStatus.Approved, "a original só é substituída quando a correção for aprovada (FR-019)");
    }

    [Fact]
    public async Task CreateManualAsync_ShouldCancelPreviousPendingCorrectionInSameTransaction_WhenCorrectingSameOriginalAgain()
    {
        var original = AddPunch(JOAO, YESTERDAY, 8, 30);
        var previous = AddPunch(JOAO, YESTERDAY, 8, 10, PunchStatus.Pending, PunchKind.Manual, replaces: original.PunchId);
        _calls.Clear();

        var info = await _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:00", replaces: original.PunchId));

        previous.Status.Should().Be(PunchStatus.Cancelled);
        _changes.Should().ContainSingle(c => c.PunchId == previous.PunchId).Which.Should().Match<PunchStatusChange>(c =>
            c.FromStatus == PunchStatus.Pending && c.ToStatus == PunchStatus.Cancelled &&
            c.Note == PunchService.AUTO_CANCEL_NOTE && c.ChangedByUserId == JOAO_USER && c.ChangedAt == NOW);
        info.ReplacesPunchId.Should().Be(original.PunchId);
        _calls.Should().Equal("begin", "nsr", $"status:{previous.PunchId}:Cancelled", "insert", "commit");
        original.Status.Should().Be(PunchStatus.Valid);
    }

    [Fact]
    public async Task CreateManualAsync_ShouldRollback_WhenPreviousCorrectionChangedConcurrently()
    {
        var original = AddPunch(JOAO, YESTERDAY, 8, 30);
        AddPunch(JOAO, YESTERDAY, 8, 10, PunchStatus.Pending, PunchKind.Manual, replaces: original.PunchId);
        _punches.Setup(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>())).ReturnsAsync(false);

        var act = () => _sut.CreateManualAsync(COMPANY, JOAO_USER, Manual(YESTERDAY, "08:00", replaces: original.PunchId));

        await act.Should().ThrowAsync<ConflictException>().WithMessage(PunchService.STATUS_CHANGED_MESSAGE);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
        _punches.Verify(r => r.InsertAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()), Times.Never);
    }

    // ---------- Cancelamento ----------

    [Fact]
    public async Task CancelAsync_ShouldCancelOwnPendingManualPunch_AndRecordWhoAndWhen()
    {
        var manual = AddPunch(JOAO, YESTERDAY, 17, 0, PunchStatus.Pending, PunchKind.Manual);

        await _sut.CancelAsync(COMPANY, JOAO_USER, manual.PunchId);

        manual.Status.Should().Be(PunchStatus.Cancelled);
        _changes.Should().ContainSingle().Which.Should().Match<PunchStatusChange>(c =>
            c.PunchId == manual.PunchId && c.FromStatus == PunchStatus.Pending && c.ToStatus == PunchStatus.Cancelled &&
            c.ChangedByUserId == JOAO_USER && c.ChangedAt == NOW);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task CancelAsync_ShouldThrowForbidden_WhenCallerIsNotTheAuthor()
    {
        var manual = AddPunch(JOAO, YESTERDAY, 17, 0, PunchStatus.Pending, PunchKind.Manual);

        var act = () => _sut.CancelAsync(COMPANY, MARIA_USER, manual.PunchId);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage(PunchService.CANCEL_NOT_AUTHOR_MESSAGE);
        manual.Status.Should().Be(PunchStatus.Pending);
    }

    [Fact]
    public async Task CancelAsync_ShouldThrowConflict_WhenPunchIsNotManual()
    {
        var offline = AddPunch(JOAO, YESTERDAY, 17, 0, PunchStatus.Pending, PunchKind.Normal);

        var act = () => _sut.CancelAsync(COMPANY, JOAO_USER, offline.PunchId);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(PunchService.CANCEL_NOT_MANUAL_MESSAGE);
    }

    [Theory]
    [InlineData(PunchStatus.Approved)]
    [InlineData(PunchStatus.Rejected)]
    [InlineData(PunchStatus.Cancelled)]
    public async Task CancelAsync_ShouldThrowConflict_WhenManualPunchIsNotPending(PunchStatus status)
    {
        var manual = AddPunch(JOAO, YESTERDAY, 17, 0, status, PunchKind.Manual);

        var act = () => _sut.CancelAsync(COMPANY, JOAO_USER, manual.PunchId);

        await act.Should().ThrowAsync<ConflictException>();
        _punches.Verify(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>()), Times.Never);
    }

    [Fact]
    public async Task CancelAsync_ShouldThrowConflictAndRollback_WhenStatusChangedConcurrently()
    {
        var manual = AddPunch(JOAO, YESTERDAY, 17, 0, PunchStatus.Pending, PunchKind.Manual);
        _punches.Setup(r => r.UpdateStatusAsync(It.IsAny<Punch>(), It.IsAny<PunchStatusChange>())).ReturnsAsync(false);

        var act = () => _sut.CancelAsync(COMPANY, JOAO_USER, manual.PunchId);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(PunchService.STATUS_CHANGED_MESSAGE);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task CancelAsync_ShouldThrowNotFound_WhenPunchDoesNotExist()
    {
        var act = () => _sut.CancelAsync(COMPANY, JOAO_USER, 999_999);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
