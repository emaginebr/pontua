using FluentAssertions;
using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Pontua.Domain.Services;

namespace Pontua.Tests.Domain;

/// <summary>Testes de <see cref="DayEvaluator"/> e <see cref="WorkHoursCalculator"/> (R-07, R-09).</summary>
public class WorkHoursCalculatorTests
{
    private static readonly DateOnly MONDAY = new(2026, 11, 23);
    private static readonly DateOnly SATURDAY = MONDAY.AddDays(5);
    private static long _nsr;

    private static ResolvedSchedule WorkDay(DateOnly date, int dailyMinutes = 480, int weeklyMinutes = 2400, bool withTimes = true) => new()
    {
        Date = date,
        ScheduleId = 1,
        Mode = ScheduleMode.Weekly,
        IsWorkDay = true,
        DailyMinutes = dailyMinutes,
        WeeklyMinutes = weeklyMinutes,
        Periods = new[]
        {
            new ResolvedPeriod(1, "Entrada", withTimes ? new TimeOnly(8, 0) : null),
            new ResolvedPeriod(2, "Pausa", withTimes ? new TimeOnly(12, 0) : null),
            new ResolvedPeriod(3, "Retorno", withTimes ? new TimeOnly(13, 0) : null),
            new ResolvedPeriod(4, "Saída", withTimes ? new TimeOnly(17, 0) : null)
        }
    };

    private static ResolvedSchedule RestDay(DateOnly date, int weeklyMinutes = 2400) => new()
    {
        Date = date,
        ScheduleId = 1,
        Mode = ScheduleMode.Weekly,
        IsWorkDay = false,
        DailyMinutes = 0,
        WeeklyMinutes = weeklyMinutes
    };

    /// <summary>Marcação no dia, com horário "HH:mm[:ss]" (UTC — o cálculo independe do fuso).</summary>
    private static Punch At(DateOnly date, string time, PunchStatus status = PunchStatus.Valid)
    {
        // Superseded só é alcançável a partir de Valid/Approved; os demais status partem de Pending.
        var initial = status is PunchStatus.Valid or PunchStatus.Superseded ? PunchStatus.Valid : PunchStatus.Pending;
        var punch = Punch.Create(
            companyId: 1,
            memberId: 15,
            nsr: Interlocked.Increment(ref _nsr),
            kind: PunchKind.Normal,
            punchedAtUtc: date.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            workDate: date,
            receivedAtUtc: date.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            status: initial,
            pendingReason: initial == PunchStatus.Pending ? PendingReason.OutsideWorkday : null,
            createdByUserId: 7);

        if (status != initial)
            punch.ChangeStatus(status, 7, null, DateTime.UtcNow);
        return punch;
    }

    [Fact]
    public void Evaluate_ShouldSumPairsAndAssignPeriods_WhenDayHasFourValidPunches()
    {
        var punches = new[] { At(MONDAY, "13:00"), At(MONDAY, "08:00"), At(MONDAY, "17:00"), At(MONDAY, "12:00") };

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), punches);

        day.WorkedMinutes.Should().Be(480);
        day.ExpectedMinutes.Should().Be(480);
        day.BalanceMinutes.Should().Be(0);
        day.Incomplete.Should().BeFalse();
        day.Missing.Should().BeFalse();
        day.HasPending.Should().BeFalse();
        day.Punches.Select(p => p.Period!.Name).Should().Equal("Entrada", "Pausa", "Retorno", "Saída");
        day.Periods.Should().OnlyContain(slot => slot.Punch != null);
        DayEvaluator.PeriodNameOf(day, punches[2]).Should().Be("Saída");
    }

    [Fact]
    public void Evaluate_ShouldMarkIncompleteAndIgnoreUnpairedPunch_WhenCountingPunchesAreOdd()
    {
        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY),
            new[] { At(MONDAY, "08:00"), At(MONDAY, "12:00"), At(MONDAY, "13:00") });

        day.WorkedMinutes.Should().Be(240);
        day.Incomplete.Should().BeTrue();
        day.BalanceMinutes.Should().Be(-240);
        day.Periods[3].Punch.Should().BeNull();
    }

    [Fact]
    public void Evaluate_ShouldNotCountPendingPunchButAssignItsPeriod_WhenPunchIsPending()
    {
        var pending = At(MONDAY, "12:00", PunchStatus.Pending);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), new[] { At(MONDAY, "08:00"), pending });

        day.WorkedMinutes.Should().Be(0);
        day.Incomplete.Should().BeTrue();
        day.HasPending.Should().BeTrue();
        day.Missing.Should().BeFalse();
        DayEvaluator.PeriodNameOf(day, pending).Should().Be("Pausa");
    }

    [Fact]
    public void Evaluate_ShouldCountApprovedPunch_WhenPendingPunchWasApproved()
    {
        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY),
            new[] { At(MONDAY, "08:00"), At(MONDAY, "12:00", PunchStatus.Approved) });

        day.WorkedMinutes.Should().Be(240);
        day.Incomplete.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_ShouldLeaveExtraPunchWithoutPeriod_WhenThereAreMorePunchesThanPeriods()
    {
        var extra = At(MONDAY, "18:00");
        var punches = new[] { At(MONDAY, "08:00"), At(MONDAY, "12:00"), At(MONDAY, "13:00"), At(MONDAY, "17:00"), extra };

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), punches);

        DayEvaluator.PeriodNameOf(day, extra).Should().BeNull();
        day.Punches.Count(p => p.Period != null).Should().Be(4);
        day.WorkedMinutes.Should().Be(480);
        day.Incomplete.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldIgnoreNonEffectivePunchesInPeriodAssociation_WhenPunchesWereRejectedCancelledOrSuperseded()
    {
        var superseded = At(MONDAY, "07:50", PunchStatus.Superseded);
        var rejected = At(MONDAY, "09:00", PunchStatus.Rejected);
        var cancelled = At(MONDAY, "10:00", PunchStatus.Cancelled);
        var entrada = At(MONDAY, "08:00", PunchStatus.Approved);
        var pausa = At(MONDAY, "12:00");

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), new[] { superseded, rejected, cancelled, entrada, pausa });

        day.Punches.Should().HaveCount(5, "todas as marcações aparecem no dia, inclusive as não efetivas");
        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, superseded).Should().BeNull();
        DayEvaluator.PeriodNameOf(day, rejected).Should().BeNull();
        day.WorkedMinutes.Should().Be(240);
    }

    [Fact]
    public void Evaluate_ShouldAssociateByOrder_WhenScheduleIsFlexibleWithoutExpectedTimes()
    {
        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY, withTimes: false),
            new[] { At(MONDAY, "10:17"), At(MONDAY, "14:02") });

        day.Periods.Should().OnlyContain(slot => slot.Period.ExpectedTime == null);
        day.Punches.Select(p => p.Period!.Name).Should().Equal("Entrada", "Pausa");
        day.WorkedMinutes.Should().Be(225);
    }

    [Fact]
    public void Evaluate_ShouldHaveZeroExpectedAndNotBeMissing_WhenDayIsNotAWorkDay()
    {
        var day = DayEvaluator.Evaluate(SATURDAY, RestDay(SATURDAY),
            new[] { At(SATURDAY, "09:00", PunchStatus.Approved), At(SATURDAY, "11:30", PunchStatus.Approved) });

        day.IsWorkDay.Should().BeFalse();
        day.ExpectedMinutes.Should().Be(0);
        day.WorkedMinutes.Should().Be(150);
        day.BalanceMinutes.Should().Be(150);
        day.Missing.Should().BeFalse();
        day.Punches.Should().OnlyContain(p => p.Period == null);
    }

    [Fact]
    public void Evaluate_ShouldBeMissing_WhenWorkDayHasNoEffectivePunch()
    {
        var empty = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), Array.Empty<Punch>());
        var onlyRejected = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), new[] { At(MONDAY, "08:00", PunchStatus.Rejected) });
        var rest = DayEvaluator.Evaluate(SATURDAY, RestDay(SATURDAY), Array.Empty<Punch>());
        var noSchedule = DayEvaluator.Evaluate(MONDAY, null, Array.Empty<Punch>());

        empty.Missing.Should().BeTrue();
        empty.BalanceMinutes.Should().Be(-480);
        onlyRejected.Missing.Should().BeTrue();
        rest.Missing.Should().BeFalse();
        noSchedule.Missing.Should().BeFalse();
        noSchedule.ExpectedMinutes.Should().Be(0);
    }

    [Fact]
    public void CalculateWorked_ShouldTruncateSecondsOfEachPunch_WhenPunchesHaveSeconds()
    {
        var (worked, incomplete) = WorkHoursCalculator.CalculateWorked(
            new[] { At(MONDAY, "08:02:41"), At(MONDAY, "12:00:05") });

        worked.Should().Be(238);
        incomplete.Should().BeFalse();
    }

    [Theory]
    [InlineData(2026, 11, 23, 2026, 11, 23)] // segunda
    [InlineData(2026, 11, 25, 2026, 11, 23)] // quarta
    [InlineData(2026, 11, 29, 2026, 11, 23)] // domingo
    [InlineData(2026, 11, 1, 2026, 10, 26)]  // domingo, semana começa no mês anterior
    public void WeekStart_ShouldReturnMonday_WhenGivenAnyDayOfTheWeek(int y, int m, int d, int ey, int em, int ed) =>
        WorkHoursCalculator.WeekStart(new DateOnly(y, m, d)).Should().Be(new DateOnly(ey, em, ed));

    [Fact]
    public void SummarizeWeeks_ShouldUseWeeklyLoadForFullWeeksAndDailySumForPartialWeeks_WhenFilterCutsWeeks()
    {
        // Jornada seg–sex 480 min/dia, mas carga semanal 2640 (44 h) — distingue as duas regras.
        var start = new DateOnly(2026, 11, 1);   // domingo
        var end = new DateOnly(2026, 11, 30);    // segunda
        var days = new List<DayEvaluation>();
        for (var date = start; date <= end; date = date.AddDays(1))
        {
            var isWorkDay = date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);
            var schedule = isWorkDay ? WorkDay(date, 480, 2640) : RestDay(date, 2640);
            var punches = isWorkDay && date.Day == 3 ? new[] { At(date, "08:00"), At(date, "16:50") } : Array.Empty<Punch>();
            days.Add(DayEvaluator.Evaluate(date, schedule, punches));
        }

        var weeks = WorkHoursCalculator.SummarizeWeeks(days, start, end);

        weeks.Should().HaveCount(6);

        weeks[0].WeekStart.Should().Be(new DateOnly(2026, 10, 26));
        weeks[0].From.Should().Be(start);
        weeks[0].To.Should().Be(start);
        weeks[0].Partial.Should().BeTrue();
        weeks[0].ExpectedMinutes.Should().Be(0);

        weeks[1].WeekStart.Should().Be(new DateOnly(2026, 11, 2));
        weeks[1].Partial.Should().BeFalse();
        weeks[1].ExpectedMinutes.Should().Be(2640);
        weeks[1].WorkedMinutes.Should().Be(530);
        weeks[1].BalanceMinutes.Should().Be(530 - 2640);

        weeks[5].WeekStart.Should().Be(end);
        weeks[5].From.Should().Be(end);
        weeks[5].To.Should().Be(end);
        weeks[5].Partial.Should().BeTrue();
        weeks[5].ExpectedMinutes.Should().Be(480);
    }

    [Fact]
    public void SummarizeWeeks_ShouldUseWeeklyLoadOfFirstWorkDay_WhenScheduleChangesInsideAFullWeek()
    {
        var monday = MONDAY;
        var days = Enumerable.Range(0, 7).Select(offset =>
        {
            var date = monday.AddDays(offset);
            var weekly = offset < 2 ? 2400 : 1800; // nova versão a partir de quarta
            var schedule = offset < 5 ? WorkDay(date, weekly / 5, weekly) : RestDay(date, weekly);
            return DayEvaluator.Evaluate(date, schedule, Array.Empty<Punch>());
        }).ToList();

        var weeks = WorkHoursCalculator.SummarizeWeeks(days, monday, monday.AddDays(6));

        weeks.Should().ContainSingle();
        weeks[0].Partial.Should().BeFalse();
        weeks[0].ExpectedMinutes.Should().Be(2400);
    }

    [Fact]
    public void Evaluate_ShouldHaveZeroExpectedAndNotBeMissing_WhenDayDoesNotCount()
    {
        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(MONDAY), Array.Empty<Punch>(), countsExpected: false);

        day.IsWorkDay.Should().BeTrue();
        day.CountsExpected.Should().BeFalse();
        day.ExpectedMinutes.Should().Be(0);
        day.BalanceMinutes.Should().Be(0);
        day.Missing.Should().BeFalse();
    }

    [Fact]
    public void SummarizeWeeks_ShouldSumDailyLoadsOfCountingDays_WhenSomeDayOfAFullWeekDoesNotCount()
    {
        var days = Enumerable.Range(0, 7)
            .Select(i => MONDAY.AddDays(i))
            .Select(date => DayEvaluator.Evaluate(
                date,
                date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday ? RestDay(date) : WorkDay(date),
                Array.Empty<Punch>(),
                countsExpected: date <= MONDAY.AddDays(1))) // "hoje" = terça
            .ToList();

        var week = WorkHoursCalculator.SummarizeWeeks(days, MONDAY, MONDAY.AddDays(6)).Single();

        week.Partial.Should().BeFalse();
        week.ExpectedMinutes.Should().Be(2 * 480);
    }
}
