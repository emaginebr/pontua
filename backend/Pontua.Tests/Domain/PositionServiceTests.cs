using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Application.Json;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

/// <summary>Testes de <see cref="ScheduleInputValidator"/>, <see cref="ScheduleFactory"/> e <see cref="PositionService"/>.</summary>
public class PositionServiceTests
{
    private static readonly DateTime NOW = new(2026, 11, 25, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly TODAY = new(2026, 11, 25);

    private const long COMPANY = 3;
    private const long OWNER_USER = 7;
    private const long EMPLOYEE_USER = 9;
    private const long ATENDENTE = 40;
    private const long CAIXA = 41;

    private readonly Mock<IPositionRepository<Position>> _positions = new();
    private readonly Mock<IScheduleRepository<Schedule>> _schedules = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ICompanyAccessPolicy> _access = new();
    private readonly Mock<IClock> _clock = new();
    private readonly ScheduleInputValidator _scheduleValidator = new();
    private readonly PositionService _sut;

    public PositionServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _companies.Setup(r => r.GetByIdAsync(COMPANY))
            .ReturnsAsync(new Company { CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = OWNER_USER });

        var ownerContext = new AccessContext
        {
            CompanyId = COMPANY, UserId = OWNER_USER, MemberId = 12, IsActive = true, IsOwner = true
        };
        var employeeContext = new AccessContext
        {
            CompanyId = COMPANY, UserId = EMPLOYEE_USER, MemberId = 14, IsActive = true
        };
        _access.Setup(a => a.RequireMemberAsync(COMPANY, OWNER_USER)).ReturnsAsync(ownerContext);
        _access.Setup(a => a.RequireOwnerAsync(COMPANY, OWNER_USER)).ReturnsAsync(ownerContext);
        _access.Setup(a => a.RequireMemberAsync(COMPANY, EMPLOYEE_USER)).ReturnsAsync(employeeContext);
        _access.Setup(a => a.RequireOwnerAsync(COMPANY, EMPLOYEE_USER))
            .ThrowsAsync(new ForbiddenException("Somente o responsável pela empresa pode realizar esta operação."));

        _positions.Setup(r => r.GetByIdAsync(COMPANY, ATENDENTE))
            .ReturnsAsync(new Position { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" });
        _positions.Setup(r => r.GetByIdAsync(COMPANY, CAIXA))
            .ReturnsAsync(new Position { PositionId = CAIXA, CompanyId = COMPANY, Name = "Caixa" });
        _positions.Setup(r => r.InsertAsync(It.IsAny<Position>())).ReturnsAsync((Position p) =>
        {
            p.PositionId = 50;
            return p;
        });
        _positions.Setup(r => r.UpdateAsync(It.IsAny<Position>())).ReturnsAsync((Position p) => p);
        _schedules.Setup(r => r.InsertAsync(It.IsAny<Schedule>())).ReturnsAsync((Schedule s) =>
        {
            s.ScheduleId = 90;
            return s;
        });
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>());

        SetupMembers();

        _sut = new PositionService(
            _positions.Object,
            _schedules.Object,
            _members.Object,
            _companies.Object,
            _unitOfWork.Object,
            _access.Object,
            new CompanyClock(_clock.Object),
            _clock.Object,
            new PositionInsertInfoValidator(),
            new PositionUpdateInfoValidator(),
            _scheduleValidator,
            NullLogger<PositionService>.Instance);
    }

    /// <summary>
    /// Membros: 12 (ativo, Atendente), 14 (ativo, Caixa → Atendente a partir de amanhã), 15 (inativo, Atendente).
    /// Hoje: Atendente tem 1 ativo; Caixa tem 1 ativo.
    /// </summary>
    private void SetupMembers(params Member[] extra)
    {
        var members = new List<Member>
        {
            new() { MemberId = 12, CompanyId = COMPANY, UserId = OWNER_USER, Status = MemberStatus.Active },
            new() { MemberId = 14, CompanyId = COMPANY, UserId = EMPLOYEE_USER, Status = MemberStatus.Active },
            new() { MemberId = 15, CompanyId = COMPANY, UserId = 10, Status = MemberStatus.Inactive }
        };
        members.AddRange(extra);
        var history = new List<MemberPosition>
        {
            new() { MemberId = 12, PositionId = ATENDENTE, EffectiveFrom = TODAY.AddDays(-30) },
            new() { MemberId = 14, PositionId = CAIXA, EffectiveFrom = TODAY.AddDays(-30) },
            new() { MemberId = 14, PositionId = ATENDENTE, EffectiveFrom = TODAY.AddDays(1) },
            new() { MemberId = 15, PositionId = ATENDENTE, EffectiveFrom = TODAY.AddDays(-30) }
        };
        _members.Setup(r => r.ListByCompanyAsync(COMPANY)).ReturnsAsync(members);
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => history.Where(mp => ids.Contains(mp.MemberId)).ToList());
    }

    private static ScheduleInput Weekly(DateOnly? effectiveFrom = null) => new()
    {
        Mode = "weekly",
        EffectiveFrom = effectiveFrom,
        WeeklyMinutes = 2640,
        WorkDays = new List<int> { 1, 2, 3, 4, 5 },
        DailyMinutes = 528,
        Periods = new List<SchedulePeriodInput>
        {
            new() { Name = "Entrada", ExpectedTime = new TimeOnly(8, 0) },
            new() { Name = "Pausa", ExpectedTime = new TimeOnly(12, 0) },
            new() { Name = "Retorno", ExpectedTime = new TimeOnly(13, 0) },
            new() { Name = "Saída", ExpectedTime = new TimeOnly(17, 48) }
        }
    };

    /// <summary>Diário: seg–sex Entrada/Saída flexíveis (480 min) e sábado Entrada 08:00 / Saída 12:00 (240 min).</summary>
    private static ScheduleInput Daily()
    {
        var days = Enumerable.Range(1, 5).Select(day => new ScheduleDayInput
        {
            DayOfWeek = day,
            DailyMinutes = 480,
            Periods = new List<SchedulePeriodInput> { new() { Name = "Entrada" }, new() { Name = "Saída" } }
        }).ToList();
        days.Add(new ScheduleDayInput
        {
            DayOfWeek = 6,
            DailyMinutes = 240,
            Periods = new List<SchedulePeriodInput>
            {
                new() { Name = "Entrada", ExpectedTime = new TimeOnly(8, 0) },
                new() { Name = "Saída", ExpectedTime = new TimeOnly(12, 0) }
            }
        });
        return new ScheduleInput { Mode = "daily", WeeklyMinutes = 2640, Days = days };
    }

    private static Schedule Version(long scheduleId, long positionId, DateOnly effectiveFrom, int dailyMinutes = 480)
    {
        var input = Weekly();
        input.DailyMinutes = dailyMinutes;
        var schedule = ScheduleFactory.Create(input, COMPANY, positionId, null, effectiveFrom, OWNER_USER, NOW);
        schedule.ScheduleId = scheduleId;
        return schedule;
    }

    // ---------------------------------------------------------------- ScheduleInputValidator

    [Fact]
    public async Task ScheduleInputValidator_ShouldAccept_WhenWeeklyScheduleIsComplete()
    {
        var result = await _scheduleValidator.ValidateAsync(Weekly());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task ScheduleInputValidator_ShouldAccept_WhenDailyScheduleHasFlexiblePeriodsWithoutTime()
    {
        var result = await _scheduleValidator.ValidateAsync(Daily());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task ScheduleInputValidator_ShouldReject_WhenWeeklyModeHasNoWorkDaysDailyMinutesOrPeriods()
    {
        var input = new ScheduleInput { Mode = "weekly", WeeklyMinutes = 2400 };

        var result = await _scheduleValidator.ValidateAsync(input);

        result.Errors.Select(e => e.PropertyName).Should().Contain(new[] { "WorkDays", "DailyMinutes", "Periods" });
    }

    [Fact]
    public async Task ScheduleInputValidator_ShouldReject_WhenDailyModeRepeatsDayOfWeek()
    {
        var input = Daily();
        input.Days![1].DayOfWeek = input.Days[0].DayOfWeek;

        var result = await _scheduleValidator.ValidateAsync(input);

        result.Errors.Should().Contain(e => e.PropertyName == "Days");
    }

    [Fact]
    public async Task ScheduleInputValidator_ShouldReject_WhenExpectedTimesAreNotIncreasing()
    {
        var input = Weekly();
        input.Periods![2].ExpectedTime = new TimeOnly(11, 0);

        var result = await _scheduleValidator.ValidateAsync(input);

        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("crescentes"));
    }

    [Fact]
    public async Task ScheduleInputValidator_ShouldReject_WhenDayHasMoreThan12Periods()
    {
        var input = Weekly();
        input.Periods = Enumerable.Range(1, 13).Select(i => new SchedulePeriodInput { Name = $"P{i}" }).ToList();

        var result = await _scheduleValidator.ValidateAsync(input);

        result.Errors.Should().Contain(e => e.PropertyName == "Periods");
    }

    [Theory]
    [InlineData("monthly", 2400, 480, 1)]
    [InlineData("weekly", 0, 480, 1)]
    [InlineData("weekly", 10081, 480, 1)]
    [InlineData("weekly", 2400, 0, 1)]
    [InlineData("weekly", 2400, 1441, 1)]
    [InlineData("weekly", 2400, 480, 7)]
    public async Task ScheduleInputValidator_ShouldReject_WhenValuesAreOutOfRange(string mode, int weekly, int daily, int workDay)
    {
        var input = Weekly();
        input.Mode = mode;
        input.WeeklyMinutes = weekly;
        input.DailyMinutes = daily;
        input.WorkDays = new List<int> { workDay };

        var result = await _scheduleValidator.ValidateAsync(input);

        result.IsValid.Should().BeFalse();
    }

    // ---------------------------------------------------------------- ScheduleFactory

    [Fact]
    public void Create_ShouldStoreSharedPeriodsWithNullDayOfWeek_WhenModeIsWeekly()
    {
        var schedule = ScheduleFactory.Create(Weekly(), COMPANY, ATENDENTE, null, TODAY, OWNER_USER, NOW);

        schedule.Mode.Should().Be(ScheduleMode.Weekly);
        schedule.PositionId.Should().Be(ATENDENTE);
        schedule.MemberId.Should().BeNull();
        schedule.Days.Should().HaveCount(5).And.OnlyContain(d => d.DailyMinutes == 528);
        schedule.Periods.Should().HaveCount(4).And.OnlyContain(p => p.DayOfWeek == null);
        schedule.Periods.Select(p => p.Sequence).Should().Equal(1, 2, 3, 4);
    }

    [Fact]
    public void Create_ShouldStorePeriodsPerDay_WhenModeIsDaily()
    {
        var schedule = ScheduleFactory.Create(Daily(), COMPANY, ATENDENTE, null, TODAY, OWNER_USER, NOW);

        schedule.Mode.Should().Be(ScheduleMode.Daily);
        schedule.Days.Should().HaveCount(6);
        schedule.Periods.Should().HaveCount(12).And.OnlyContain(p => p.DayOfWeek != null);
        schedule.Periods.Where(p => p.DayOfWeek == DayOfWeek.Saturday)
            .Select(p => (p.Sequence, p.Name, p.ExpectedTime))
            .Should().Equal((1, "Entrada", new TimeOnly(8, 0)), (2, "Saída", new TimeOnly(12, 0)));
    }

    [Fact]
    public void Create_ShouldThrow_WhenOwnerIsBothPositionAndMember()
    {
        var act = () => ScheduleFactory.Create(Weekly(), COMPANY, ATENDENTE, 12, TODAY, OWNER_USER, NOW);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ToInfo_ShouldExpandWeeklyScheduleByWorkDay_WhenModeIsWeekly()
    {
        var info = ScheduleFactory.ToInfo(ScheduleFactory.Create(Weekly(), COMPANY, ATENDENTE, null, TODAY, OWNER_USER, NOW));

        info.Mode.Should().Be("weekly");
        info.EffectiveFrom.Should().Be(TODAY);
        info.WeeklyMinutes.Should().Be(2640);
        info.Days.Select(d => d.DayOfWeek).Should().Equal(1, 2, 3, 4, 5);
        info.Days.Should().OnlyContain(d => d.DailyMinutes == 528
            && d.Periods.Select(p => p.Name).SequenceEqual(new[] { "Entrada", "Pausa", "Retorno", "Saída" }));
        info.Days[0].Periods[3].ExpectedTime.Should().Be(new TimeOnly(17, 48));
    }

    [Fact]
    public void ToInfo_ShouldKeepEachDayOwnPeriods_WhenModeIsDaily()
    {
        var info = ScheduleFactory.ToInfo(ScheduleFactory.Create(Daily(), COMPANY, ATENDENTE, null, TODAY, OWNER_USER, NOW));

        info.Mode.Should().Be("daily");
        var saturday = info.Days.Single(d => d.DayOfWeek == 6);
        saturday.DailyMinutes.Should().Be(240);
        saturday.Periods.Select(p => p.ExpectedTime).Should().Equal(new TimeOnly(8, 0), new TimeOnly(12, 0));
        info.Days.Single(d => d.DayOfWeek == 1).Periods.Should().OnlyContain(p => p.ExpectedTime == null);
    }

    [Fact]
    public void ScheduleInput_ShouldDeserializeContractExample_WhenUsingApiJsonOptions()
    {
        const string json = """
            { "mode": "daily", "effectiveFrom": "2026-12-01", "weeklyMinutes": 2640,
              "days": [ { "dayOfWeek": 6, "dailyMinutes": 240,
                          "periods": [ { "name": "Entrada", "expectedTime": "08:00" }, { "name": "Saída", "expectedTime": null } ] } ] }
            """;
        var options = new System.Text.Json.JsonSerializerOptions().ConfigurePontuaJson();

        var input = System.Text.Json.JsonSerializer.Deserialize<ScheduleInput>(json, options)!;
        var output = System.Text.Json.JsonSerializer.Serialize(
            ScheduleFactory.ToInfo(ScheduleFactory.Create(input, COMPANY, ATENDENTE, null, input.EffectiveFrom!.Value, OWNER_USER, NOW)),
            options);

        input.EffectiveFrom.Should().Be(new DateOnly(2026, 12, 1));
        input.Days![0].Periods[0].ExpectedTime.Should().Be(new TimeOnly(8, 0));
        input.Days[0].Periods[1].ExpectedTime.Should().BeNull();
        output.Should().Contain("\"effectiveFrom\":\"2026-12-01\"")
            .And.Contain("\"expectedTime\":\"08:00\"")
            .And.Contain("\"mode\":\"daily\"");
    }

    // ---------------------------------------------------------------- PositionService

    [Fact]
    public async Task CreateAsync_ShouldThrowForbidden_WhenUserIsNotOwner()
    {
        var act = () => _sut.CreateAsync(COMPANY, EMPLOYEE_USER, new PositionInsertInfo { Name = "Atendente", Schedule = Weekly() });

        await act.Should().ThrowAsync<ForbiddenException>();
        _positions.Verify(r => r.InsertAsync(It.IsAny<Position>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_ShouldThrowConflict_WhenNameAlreadyExistsInCompany()
    {
        _positions.Setup(r => r.ExistsNameAsync(COMPANY, "Atendente", null)).ReturnsAsync(true);

        var act = () => _sut.CreateAsync(COMPANY, OWNER_USER, new PositionInsertInfo { Name = " Atendente ", Schedule = Weekly() });

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task CreateAsync_ShouldThrowValidation_WhenScheduleIsMissing()
    {
        var act = () => _sut.CreateAsync(COMPANY, OWNER_USER, new PositionInsertInfo { Name = "Atendente" });

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().Contain(e => e.Field == "schedule");
    }

    [Fact]
    public async Task CreateAsync_ShouldInsertPositionAndScheduleEffectiveToday_WhenDataIsValid()
    {
        Schedule? inserted = null;
        _schedules.Setup(r => r.InsertAsync(It.IsAny<Schedule>()))
            .Callback((Schedule s) => inserted = s)
            .ReturnsAsync((Schedule s) => s);

        var info = await _sut.CreateAsync(COMPANY, OWNER_USER,
            new PositionInsertInfo { Name = "Atendente", Schedule = Weekly(effectiveFrom: TODAY.AddDays(10)) });

        info.PositionId.Should().Be(50);
        info.Name.Should().Be("Atendente");
        info.ActiveMembers.Should().Be(0);
        info.CurrentSchedule!.EffectiveFrom.Should().Be(TODAY);
        inserted!.PositionId.Should().Be(50);
        inserted.EffectiveFrom.Should().Be(TODAY);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ShouldThrowConflict_WhenAnotherPositionHasTheName()
    {
        _positions.Setup(r => r.ExistsNameAsync(COMPANY, "Caixa", ATENDENTE)).ReturnsAsync(true);

        var act = () => _sut.UpdateAsync(COMPANY, OWNER_USER, ATENDENTE, new PositionUpdateInfo { Name = "Caixa" });

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task UpdateAsync_ShouldThrowNotFound_WhenPositionBelongsToAnotherCompany()
    {
        var act = () => _sut.UpdateAsync(COMPANY, OWNER_USER, 777, new PositionUpdateInfo { Name = "Novo" });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task SaveScheduleAsync_ShouldThrowBusinessRule_WhenEffectiveFromIsInThePast()
    {
        var act = () => _sut.SaveScheduleAsync(COMPANY, OWNER_USER, ATENDENTE, Weekly(effectiveFrom: TODAY.AddDays(-1)));

        await act.Should().ThrowAsync<BusinessRuleException>();
        _schedules.Verify(r => r.InsertAsync(It.IsAny<Schedule>()), Times.Never);
    }

    [Fact]
    public async Task SaveScheduleAsync_ShouldThrowForbidden_WhenUserIsNotOwner()
    {
        var act = () => _sut.SaveScheduleAsync(COMPANY, EMPLOYEE_USER, ATENDENTE, Weekly());

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task SaveScheduleAsync_ShouldInsertNewVersionWithoutTouchingCurrent_WhenEffectiveFromIsFuture()
    {
        var future = TODAY.AddDays(6);

        var info = await _sut.SaveScheduleAsync(COMPANY, OWNER_USER, ATENDENTE, Weekly(effectiveFrom: future));

        info.EffectiveFrom.Should().Be(future);
        _schedules.Verify(r => r.DeleteAsync(It.IsAny<long>()), Times.Never);
        _schedules.Verify(r => r.InsertAsync(It.Is<Schedule>(s => s.EffectiveFrom == future && s.PositionId == ATENDENTE)), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task SaveScheduleAsync_ShouldReplaceVersion_WhenSameFutureDateAlreadyExists()
    {
        var future = TODAY.AddDays(6);
        _schedules.Setup(r => r.GetByPositionAndDateAsync(ATENDENTE, future)).ReturnsAsync(Version(77, ATENDENTE, future));

        var input = Daily();
        input.EffectiveFrom = future;

        var info = await _sut.SaveScheduleAsync(COMPANY, OWNER_USER, ATENDENTE, input);

        info.Mode.Should().Be("daily");
        _schedules.Verify(r => r.DeleteAsync(77), Times.Once);
        _schedules.Verify(r => r.InsertAsync(It.Is<Schedule>(s => s.EffectiveFrom == future)), Times.Once);
    }

    [Fact]
    public async Task SaveScheduleAsync_ShouldUseToday_WhenEffectiveFromIsOmitted()
    {
        var info = await _sut.SaveScheduleAsync(COMPANY, OWNER_USER, ATENDENTE, Weekly(effectiveFrom: null));

        info.EffectiveFrom.Should().Be(TODAY);
    }

    [Fact]
    public async Task DeleteAsync_ShouldThrowBusinessRule_WhenPositionHasActiveMembers()
    {
        var act = () => _sut.DeleteAsync(COMPANY, OWNER_USER, ATENDENTE);

        await act.Should().ThrowAsync<BusinessRuleException>();
        _positions.Verify(r => r.DeleteAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_ShouldThrowConflict_WhenPositionHasHistoryButNoActiveMembers()
    {
        _positions.Setup(r => r.GetByIdAsync(COMPANY, 60)).ReturnsAsync(new Position { PositionId = 60, CompanyId = COMPANY, Name = "Antigo" });
        _positions.Setup(r => r.HasHistoryAsync(60)).ReturnsAsync(true);

        var act = () => _sut.DeleteAsync(COMPANY, OWNER_USER, 60);

        await act.Should().ThrowAsync<ConflictException>();
        _positions.Verify(r => r.DeleteAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_ShouldDeletePosition_WhenItWasNeverUsed()
    {
        _positions.Setup(r => r.GetByIdAsync(COMPANY, 60)).ReturnsAsync(new Position { PositionId = 60, CompanyId = COMPANY, Name = "Novo" });
        _positions.Setup(r => r.HasHistoryAsync(60)).ReturnsAsync(false);

        await _sut.DeleteAsync(COMPANY, OWNER_USER, 60);

        _positions.Verify(r => r.DeleteAsync(60), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ShouldThrowForbidden_WhenUserIsNotOwner()
    {
        var act = () => _sut.DeleteAsync(COMPANY, EMPLOYEE_USER, ATENDENTE);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task GetAsync_ShouldReturnCurrentScheduleAndFullHistory_WhenFutureVersionExists()
    {
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>
        {
            Version(1, ATENDENTE, TODAY.AddDays(-30), dailyMinutes: 480),
            Version(2, ATENDENTE, TODAY.AddDays(-5), dailyMinutes: 500),
            Version(3, ATENDENTE, TODAY.AddDays(5), dailyMinutes: 528)
        });

        var info = await _sut.GetAsync(COMPANY, EMPLOYEE_USER, ATENDENTE);

        info.CurrentSchedule!.ScheduleId.Should().Be(2);
        info.ScheduleHistory!.Select(s => s.ScheduleId).Should().Equal(3, 2, 1);
        info.ActiveMembers.Should().Be(1);
    }

    [Fact]
    public async Task ListAsync_ShouldCountOnlyActiveMembersByPositionInEffectToday_WhenMembersChangePosition()
    {
        _positions.Setup(r => r.ListByCompanyAsync(COMPANY)).ReturnsAsync(new List<Position>
        {
            new() { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" },
            new() { PositionId = CAIXA, CompanyId = COMPANY, Name = "Caixa" }
        });
        _schedules.Setup(r => r.ListByPositionsAsync(It.IsAny<IEnumerable<long>>())).ReturnsAsync(new List<Schedule>
        {
            Version(1, ATENDENTE, TODAY.AddDays(-30)),
            Version(2, CAIXA, TODAY.AddDays(-30))
        });

        var list = await _sut.ListAsync(COMPANY, EMPLOYEE_USER);

        list.Should().HaveCount(2);
        list.Single(p => p.PositionId == ATENDENTE).ActiveMembers.Should().Be(1);
        list.Single(p => p.PositionId == CAIXA).ActiveMembers.Should().Be(1);
        list.Should().OnlyContain(p => p.CurrentSchedule != null && p.ScheduleHistory == null);
    }
}
