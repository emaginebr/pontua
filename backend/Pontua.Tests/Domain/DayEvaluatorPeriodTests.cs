using FluentAssertions;
using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Pontua.Domain.Services;

namespace Pontua.Tests.Domain;

/// <summary>
/// Associação de marcações a períodos com correções e inclusões pendentes (R-07, atualização — achados B-02/N-02):
/// só <c>Valid</c>/<c>Approved</c> ocupam os períodos, entre si; inclusões pendentes recebem um período hipotético
/// (como se todas as pendências fossem aprovadas) sem deslocar as que contam; correções pendentes herdam o da original.
/// </summary>
public class DayEvaluatorPeriodTests
{
    private static readonly DateOnly MONDAY = new(2026, 11, 23);
    private static long _id;

    private static ResolvedSchedule WorkDay() => new()
    {
        Date = MONDAY,
        ScheduleId = 1,
        Mode = ScheduleMode.Weekly,
        IsWorkDay = true,
        DailyMinutes = 480,
        WeeklyMinutes = 2400,
        Periods = new[]
        {
            new ResolvedPeriod(1, "Entrada", new TimeOnly(8, 0)),
            new ResolvedPeriod(2, "Pausa", new TimeOnly(12, 0)),
            new ResolvedPeriod(3, "Retorno", new TimeOnly(13, 0)),
            new ResolvedPeriod(4, "Saída", new TimeOnly(17, 0))
        }
    };

    /// <summary>Marcação normal válida (persistida: com <c>PunchId</c>).</summary>
    private static Punch Normal(string time, PunchStatus status = PunchStatus.Valid)
    {
        var punch = Punch.Create(
            companyId: 1,
            memberId: 15,
            nsr: NextId(),
            kind: PunchKind.Normal,
            punchedAtUtc: MONDAY.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            workDate: MONDAY,
            receivedAtUtc: MONDAY.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            status: PunchStatus.Valid,
            pendingReason: null,
            createdByUserId: 7);
        SetPunchId(punch, punch.Nsr);
        if (status != PunchStatus.Valid)
            punch.ChangeStatus(status, 7, null, DateTime.UtcNow);
        return punch;
    }

    /// <summary>Marcação manual pendente: inclusão (sem <paramref name="replaces"/>) ou correção.</summary>
    private static Punch Manual(string time, Punch? replaces = null, PunchStatus status = PunchStatus.Pending)
    {
        var punch = Punch.Create(
            companyId: 1,
            memberId: 15,
            nsr: NextId(),
            kind: PunchKind.Manual,
            punchedAtUtc: MONDAY.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            workDate: MONDAY,
            receivedAtUtc: MONDAY.ToDateTime(new TimeOnly(20, 0), DateTimeKind.Utc),
            status: PunchStatus.Pending,
            pendingReason: PendingReason.Manual,
            createdByUserId: 7,
            justification: "Esqueci de marcar.",
            replacesPunchId: replaces?.PunchId);
        SetPunchId(punch, punch.Nsr);
        if (status != PunchStatus.Pending)
            punch.ChangeStatus(status, 7, null, DateTime.UtcNow);
        return punch;
    }

    /// <summary>Marcação normal pendente (offline ou fora do dia útil): inclusão sem <c>ReplacesPunchId</c>.</summary>
    private static Punch PendingNormal(string time, PendingReason reason = PendingReason.Offline)
    {
        var punch = Punch.Create(
            companyId: 1,
            memberId: 15,
            nsr: NextId(),
            kind: PunchKind.Normal,
            punchedAtUtc: MONDAY.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Utc),
            workDate: MONDAY,
            receivedAtUtc: MONDAY.ToDateTime(new TimeOnly(21, 0), DateTimeKind.Utc),
            status: PunchStatus.Pending,
            pendingReason: reason,
            createdByUserId: 7);
        SetPunchId(punch, punch.Nsr);
        return punch;
    }

    private static long NextId() => Interlocked.Increment(ref _id);

    private static void SetPunchId(Punch punch, long id) =>
        typeof(Punch).GetProperty(nameof(Punch.PunchId))!.SetValue(punch, id);

    [Fact]
    public void Evaluate_ShouldKeepOriginalInItsPeriodAndGiveCorrectionTheSamePeriod_WhenEntradaCorrectionIsPending()
    {
        var entrada = Normal("08:10");
        var pausa = Normal("12:00");
        var retorno = Normal("13:00");
        var saida = Normal("17:00");
        var correction = Manual("08:00", replaces: entrada);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, retorno, saida, correction });

        DayEvaluator.PeriodNameOf(day, correction).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, retorno).Should().Be("Retorno");
        DayEvaluator.PeriodNameOf(day, saida).Should().Be("Saída");
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, pausa, retorno, saida);
        day.Punches.Count(p => p.Period == null).Should().Be(0, "nenhuma marcação vira extra por causa da correção");
        day.WorkedMinutes.Should().Be(230 + 240, "a correção pendente não conta; a original continua contando");
        day.Incomplete.Should().BeFalse();
        day.HasPending.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldNotShiftLaterPunches_WhenOnlyPunchOfTheDayHasAPendingCorrection()
    {
        // Cenário do achado B-02: original de Entrada às 19:03, correção pedida para 08:01.
        var original = Normal("19:03");
        var correction = Manual("08:01", replaces: original);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { original, correction });

        DayEvaluator.PeriodNameOf(day, original).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, correction).Should().Be("Entrada");
        day.Periods[0].Punch.Should().BeSameAs(original);
        day.Periods.Skip(1).Should().OnlyContain(slot => slot.Punch == null, "a original não é empurrada para \"Retorno\"");
    }

    [Fact]
    public void Evaluate_ShouldKeepValidPeriodsAndGiveInclusionHypotheticalEntrada_WhenPendingInclusionComesBeforeFourValidPunches()
    {
        // Cenário do achado N-02: válidas 08:00, 12:00, 13:00, 20:03 + inclusão pendente 07:30.
        var entrada = Normal("08:00");
        var pausa = Normal("12:00");
        var retorno = Normal("13:00");
        var saida = Normal("20:03");
        var inclusion = Manual("07:30");

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, retorno, saida, inclusion });

        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, retorno).Should().Be("Retorno");
        DayEvaluator.PeriodNameOf(day, saida).Should().Be("Saída", "a Saída válida não vira extra por causa da pendência");
        DayEvaluator.PeriodNameOf(day, inclusion).Should().Be("Entrada", "rótulo hipotético: seria a Entrada se aprovada");
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, pausa, retorno, saida);
        day.WorkedMinutes.Should().Be(240 + 423, "a inclusão pendente não conta");
        day.Incomplete.Should().BeFalse();
        day.Missing.Should().BeFalse();
        day.HasPending.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldNotShiftValidPunches_WhenPendingInclusionFallsBetweenThem()
    {
        var entrada = Normal("08:00");
        var inclusion = Manual("12:00");
        var retorno = Normal("13:00");
        var saida = Normal("17:00");

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { saida, inclusion, retorno, entrada });

        // As válidas associam-se entre si: 08:00 Entrada, 13:00 Pausa, 17:00 Retorno.
        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, retorno).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, saida).Should().Be("Retorno");
        DayEvaluator.PeriodNameOf(day, inclusion).Should().Be("Pausa", "hipotético: 08:00, 12:00, 13:00, 17:00");
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, retorno, saida, null);
        day.WorkedMinutes.Should().Be(300, "a inclusão pendente não conta: 08:00–13:00 e 17:00 sem par");
        day.Incomplete.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldLabelPendingPunchesByTheirOwnOrder_WhenDayHasOnlyPendingPunches()
    {
        var first = PendingNormal("08:02");
        var second = PendingNormal("12:01", PendingReason.OutsideWorkday);
        var third = Manual("13:00");

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { third, first, second });

        day.Punches.Select(p => p.Period?.Name).Should().Equal("Entrada", "Pausa", "Retorno");
        day.Periods.Should().OnlyContain(slot => slot.Punch == null, "nenhuma marcação conta ainda");
        day.WorkedMinutes.Should().Be(0);
        day.Missing.Should().BeFalse("há marcações efetivas (pendentes) no dia");
        day.HasPending.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldCombineRules_WhenDayHasPendingCorrectionAndPendingInclusion()
    {
        var entrada = Normal("08:10");
        var pausa = Normal("12:00");
        var retorno = Normal("13:00");
        var correction = Manual("08:00", replaces: entrada);
        var inclusion = Manual("17:00");

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, retorno, correction, inclusion });

        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, retorno).Should().Be("Retorno");
        DayEvaluator.PeriodNameOf(day, correction).Should().Be("Entrada", "herda o período da original");
        DayEvaluator.PeriodNameOf(day, inclusion).Should().Be("Saída", "a correção pendente não ocupa período hipotético");
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, pausa, retorno, null);
        day.WorkedMinutes.Should().Be(230);
        day.Incomplete.Should().BeTrue();
        day.HasPending.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_ShouldReorganizeLabels_WhenPendingInclusionIsApproved()
    {
        var entrada = Normal("08:00");
        var pausa = Normal("12:00");
        var retorno = Normal("13:00");
        var saida = Normal("20:03");
        var inclusion = Manual("07:30", status: PunchStatus.Approved);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, retorno, saida, inclusion });

        DayEvaluator.PeriodNameOf(day, inclusion).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Retorno");
        DayEvaluator.PeriodNameOf(day, retorno).Should().Be("Saída");
        DayEvaluator.PeriodNameOf(day, saida).Should().BeNull("aprovada a inclusão, a última passa a ser extra");
        day.Periods.Select(slot => slot.Punch).Should().Equal(inclusion, entrada, pausa, retorno);
        day.HasPending.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_ShouldPutCorrectionInOriginalsPeriod_WhenCorrectionWasApproved()
    {
        var entrada = Normal("08:10", PunchStatus.Superseded);
        var pausa = Normal("12:00");
        var retorno = Normal("13:00");
        var saida = Normal("17:00");
        var correction = Manual("08:00", replaces: entrada, status: PunchStatus.Approved);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, retorno, saida, correction });

        DayEvaluator.PeriodNameOf(day, correction).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, entrada).Should().BeNull("a original substituída sai da associação");
        day.Periods.Select(slot => slot.Punch).Should().Equal(correction, pausa, retorno, saida);
        day.WorkedMinutes.Should().Be(480);
        day.HasPending.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_ShouldGiveOnlyThePendingCorrectionTheOriginalsPeriod_WhenAnotherCorrectionWasCancelled()
    {
        var entrada = Normal("08:10");
        var pausa = Normal("12:00");
        var cancelled = Manual("07:55", replaces: entrada, status: PunchStatus.Cancelled);
        var pending = Manual("08:00", replaces: entrada);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, pausa, cancelled, pending });

        DayEvaluator.PeriodNameOf(day, entrada).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, pausa).Should().Be("Pausa");
        DayEvaluator.PeriodNameOf(day, pending).Should().Be("Entrada");
        DayEvaluator.PeriodNameOf(day, cancelled).Should().BeNull();
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, pausa, null, null);
        day.Punches.Should().HaveCount(4);
    }

    [Fact]
    public void Evaluate_ShouldLeaveCorrectionWithoutPeriod_WhenOriginalIsNotInTheEvaluatedDay()
    {
        var entrada = Normal("08:00");
        var correction = Manual("12:00");
        typeof(Punch).GetProperty(nameof(Punch.ReplacesPunchId))!.SetValue(correction, 999_999L);

        var day = DayEvaluator.Evaluate(MONDAY, WorkDay(), new[] { entrada, correction });

        DayEvaluator.PeriodNameOf(day, correction).Should().BeNull();
        day.Periods.Select(slot => slot.Punch).Should().Equal(entrada, null, null, null);
    }
}
