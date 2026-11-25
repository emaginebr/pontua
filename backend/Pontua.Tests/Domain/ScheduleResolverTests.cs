using FluentAssertions;
using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Pontua.Domain.Services;

namespace Pontua.Tests.Domain;

public class ScheduleResolverTests
{
    private const long MEMBER = 15;
    private const long ATENDENTE = 4;
    private const long CAIXA = 5;

    private static readonly DateOnly MONDAY = new(2026, 11, 23);
    private static readonly DateOnly WEDNESDAY = MONDAY.AddDays(2);
    private static readonly DateOnly SATURDAY = MONDAY.AddDays(5);
    private static readonly DateOnly NOV_1 = new(2026, 11, 1);

    private readonly ScheduleResolver _sut = new();

    private static readonly DayOfWeek[] WEEKDAYS =
        { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday };

    private static long _nextScheduleId = 100;

    private static Schedule Weekly(long? positionId, long? memberId, DateOnly effectiveFrom, int dailyMinutes, int weeklyMinutes,
        params (string Name, string? Time)[] periods) => new()
    {
        ScheduleId = Interlocked.Increment(ref _nextScheduleId),
        PositionId = positionId,
        MemberId = memberId,
        Mode = ScheduleMode.Weekly,
        WeeklyMinutes = weeklyMinutes,
        EffectiveFrom = effectiveFrom,
        Days = WEEKDAYS.Select(d => new ScheduleDay { DayOfWeek = d, DailyMinutes = dailyMinutes }).ToList(),
        Periods = periods.Select((p, i) => new SchedulePeriod
        {
            Sequence = i + 1,
            Name = p.Name,
            DayOfWeek = null,
            ExpectedTime = p.Time == null ? null : TimeOnly.Parse(p.Time)
        }).ToList()
    };

    private static Schedule DefaultWeekly(long? positionId, long? memberId, DateOnly effectiveFrom, int dailyMinutes = 480) =>
        Weekly(positionId, memberId, effectiveFrom, dailyMinutes, dailyMinutes * 5,
            ("Entrada", "08:00"), ("Pausa", "12:00"), ("Retorno", "13:00"), ("Saída", "17:00"));

    private static Schedule InheritsPosition(long memberId, DateOnly effectiveFrom) => new()
    {
        ScheduleId = Interlocked.Increment(ref _nextScheduleId),
        MemberId = memberId,
        InheritsPosition = true,
        EffectiveFrom = effectiveFrom
    };

    private static MemberPosition PositionOf(long memberId, long positionId, DateOnly effectiveFrom) =>
        new() { MemberId = memberId, PositionId = positionId, EffectiveFrom = effectiveFrom };

    [Fact]
    public void Resolve_ShouldReturnWeeklyWorkDayWithSharedPeriods_WhenPositionScheduleIsWeekly()
    {
        MONDAY.DayOfWeek.Should().Be(DayOfWeek.Monday);
        var schedule = DefaultWeekly(ATENDENTE, null, NOV_1);

        var result = _sut.Resolve(MEMBER, MONDAY, new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) }, new[] { schedule });

        result.Should().NotBeNull();
        result!.ScheduleId.Should().Be(schedule.ScheduleId);
        result.PositionId.Should().Be(ATENDENTE);
        result.IsMemberSchedule.Should().BeFalse();
        result.Mode.Should().Be(ScheduleMode.Weekly);
        result.IsWorkDay.Should().BeTrue();
        result.DailyMinutes.Should().Be(480);
        result.WeeklyMinutes.Should().Be(2400);
        result.Periods.Select(p => p.Name).Should().Equal("Entrada", "Pausa", "Retorno", "Saída");
        result.Periods[0].ExpectedTime.Should().Be(new TimeOnly(8, 0));
    }

    [Fact]
    public void Resolve_ShouldReturnNonWorkDayWithoutPeriods_WhenDayIsNotInWeeklySchedule()
    {
        var result = _sut.Resolve(MEMBER, SATURDAY, new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) },
            new[] { DefaultWeekly(ATENDENTE, null, NOV_1) });

        result!.IsWorkDay.Should().BeFalse();
        result.DailyMinutes.Should().Be(0);
        result.Periods.Should().BeEmpty();
        result.WeeklyMinutes.Should().Be(2400);
    }

    [Fact]
    public void Resolve_ShouldUsePeriodsOfTheDay_WhenScheduleIsDaily()
    {
        var daily = new Schedule
        {
            ScheduleId = 77,
            PositionId = CAIXA,
            Mode = ScheduleMode.Daily,
            WeeklyMinutes = 2640,
            EffectiveFrom = NOV_1,
            Days =
            {
                new ScheduleDay { DayOfWeek = DayOfWeek.Monday, DailyMinutes = 480 },
                new ScheduleDay { DayOfWeek = DayOfWeek.Saturday, DailyMinutes = 240 }
            },
            Periods =
            {
                new SchedulePeriod { DayOfWeek = DayOfWeek.Monday, Sequence = 1, Name = "Entrada", ExpectedTime = new TimeOnly(8, 0) },
                new SchedulePeriod { DayOfWeek = DayOfWeek.Monday, Sequence = 2, Name = "Pausa", ExpectedTime = new TimeOnly(12, 0) },
                new SchedulePeriod { DayOfWeek = DayOfWeek.Monday, Sequence = 3, Name = "Retorno", ExpectedTime = new TimeOnly(13, 0) },
                new SchedulePeriod { DayOfWeek = DayOfWeek.Monday, Sequence = 4, Name = "Saída", ExpectedTime = new TimeOnly(17, 0) },
                new SchedulePeriod { DayOfWeek = DayOfWeek.Saturday, Sequence = 2, Name = "Saída" },
                new SchedulePeriod { DayOfWeek = DayOfWeek.Saturday, Sequence = 1, Name = "Entrada" }
            }
        };
        var positions = new[] { PositionOf(MEMBER, CAIXA, NOV_1) };

        var saturday = _sut.Resolve(MEMBER, SATURDAY, positions, new[] { daily });
        var monday = _sut.Resolve(MEMBER, MONDAY, positions, new[] { daily });
        var wednesday = _sut.Resolve(MEMBER, WEDNESDAY, positions, new[] { daily });

        saturday!.Mode.Should().Be(ScheduleMode.Daily);
        saturday.IsWorkDay.Should().BeTrue();
        saturday.DailyMinutes.Should().Be(240);
        saturday.Periods.Select(p => p.Name).Should().Equal("Entrada", "Saída");
        saturday.Periods.Should().OnlyContain(p => p.ExpectedTime == null);

        monday!.DailyMinutes.Should().Be(480);
        monday.Periods.Should().HaveCount(4);

        wednesday!.IsWorkDay.Should().BeFalse();
        wednesday.Periods.Should().BeEmpty();
    }

    [Fact]
    public void ResolveRange_ShouldSwitchVersion_WhenNewScheduleBecomesEffectiveInsideTheInterval()
    {
        var v1 = DefaultWeekly(ATENDENTE, null, NOV_1, dailyMinutes: 480);
        var v2 = DefaultWeekly(ATENDENTE, null, WEDNESDAY, dailyMinutes: 360);

        var result = _sut.ResolveRange(new[] { MEMBER }, MONDAY, MONDAY.AddDays(4),
            new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) }, new[] { v2, v1 });

        var days = result[MEMBER];
        days.Should().HaveCount(5);
        days[MONDAY]!.ScheduleId.Should().Be(v1.ScheduleId);
        days[MONDAY.AddDays(1)]!.DailyMinutes.Should().Be(480);
        days[WEDNESDAY]!.ScheduleId.Should().Be(v2.ScheduleId);
        days[MONDAY.AddDays(4)]!.DailyMinutes.Should().Be(360);
    }

    [Fact]
    public void ResolveRange_ShouldResolveSeveralMembersInBatch_WhenMembersHaveDifferentPositions()
    {
        const long other = 16;
        var atendente = DefaultWeekly(ATENDENTE, null, NOV_1, 480);
        var caixa = DefaultWeekly(CAIXA, null, NOV_1, 360);

        var result = _sut.ResolveRange(new[] { MEMBER, other }, MONDAY, MONDAY,
            new[] { PositionOf(MEMBER, ATENDENTE, NOV_1), PositionOf(other, CAIXA, NOV_1) },
            new[] { atendente, caixa });

        result[MEMBER][MONDAY]!.DailyMinutes.Should().Be(480);
        result[other][MONDAY]!.DailyMinutes.Should().Be(360);
    }

    [Fact]
    public void Resolve_ShouldUseMemberSchedule_WhenMemberHasOwnScheduleInEffect()
    {
        var position = DefaultWeekly(ATENDENTE, null, NOV_1, 480);
        var own = Weekly(null, MEMBER, NOV_1.AddDays(9), 300, 1500, ("Entrada", null), ("Saída", null));

        var result = _sut.Resolve(MEMBER, MONDAY, new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) }, new[] { position, own });

        result!.ScheduleId.Should().Be(own.ScheduleId);
        result.IsMemberSchedule.Should().BeTrue();
        result.PositionId.Should().Be(ATENDENTE);
        result.DailyMinutes.Should().Be(300);
        result.Periods.Select(p => p.Name).Should().Equal("Entrada", "Saída");
    }

    [Fact]
    public void Resolve_ShouldUsePositionSchedule_WhenMemberScheduleStartsAfterTheDate()
    {
        var position = DefaultWeekly(ATENDENTE, null, NOV_1, 480);
        var own = Weekly(null, MEMBER, WEDNESDAY, 300, 1500, ("Entrada", null), ("Saída", null));

        var result = _sut.Resolve(MEMBER, MONDAY, new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) }, new[] { position, own });

        result!.ScheduleId.Should().Be(position.ScheduleId);
        result.IsMemberSchedule.Should().BeFalse();
    }

    [Fact]
    public void ResolveRange_ShouldReturnToPositionSchedule_WhenMemberVersionInheritsPosition()
    {
        var position = DefaultWeekly(ATENDENTE, null, NOV_1, 480);
        var own = Weekly(null, MEMBER, NOV_1, 300, 1500, ("Entrada", null), ("Saída", null));
        var back = InheritsPosition(MEMBER, WEDNESDAY);

        var days = _sut.ResolveRange(new[] { MEMBER }, MONDAY, MONDAY.AddDays(4),
            new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) }, new[] { position, own, back })[MEMBER];

        days[MONDAY.AddDays(1)]!.ScheduleId.Should().Be(own.ScheduleId);
        days[WEDNESDAY]!.ScheduleId.Should().Be(position.ScheduleId);
        days[WEDNESDAY]!.IsMemberSchedule.Should().BeFalse();
        days[MONDAY.AddDays(4)]!.DailyMinutes.Should().Be(480);
    }

    [Fact]
    public void ResolveRange_ShouldFollowPositionChange_WhenMemberPositionChangesWithEffectiveDate()
    {
        var atendente = DefaultWeekly(ATENDENTE, null, NOV_1, 480);
        var caixa = DefaultWeekly(CAIXA, null, NOV_1, 360);
        var history = new[] { PositionOf(MEMBER, ATENDENTE, NOV_1), PositionOf(MEMBER, CAIXA, WEDNESDAY) };

        var days = _sut.ResolveRange(new[] { MEMBER }, MONDAY, MONDAY.AddDays(4), history, new[] { atendente, caixa })[MEMBER];

        days[MONDAY]!.PositionId.Should().Be(ATENDENTE);
        days[MONDAY]!.DailyMinutes.Should().Be(480);
        days[WEDNESDAY]!.PositionId.Should().Be(CAIXA);
        days[WEDNESDAY]!.DailyMinutes.Should().Be(360);
    }

    [Fact]
    public void Resolve_ShouldReturnNull_WhenMemberHasNoPositionOnTheDate()
    {
        var result = _sut.Resolve(MEMBER, MONDAY, new[] { PositionOf(MEMBER, ATENDENTE, WEDNESDAY) },
            new[] { DefaultWeekly(ATENDENTE, null, NOV_1) });

        result.Should().BeNull();
    }

    [Fact]
    public void Resolve_ShouldReturnNull_WhenPositionHasNoScheduleVersionYet()
    {
        var result = _sut.Resolve(MEMBER, MONDAY, new[] { PositionOf(MEMBER, ATENDENTE, NOV_1) },
            new[] { DefaultWeekly(ATENDENTE, null, WEDNESDAY) });

        result.Should().BeNull();
    }
}
