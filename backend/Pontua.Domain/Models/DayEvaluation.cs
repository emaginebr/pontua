namespace Pontua.Domain.Models;

/// <summary>Avaliação de um dia de um membro (R-07, R-09) — objeto calculado, não persistido.</summary>
public sealed class DayEvaluation
{
    public DateOnly Date { get; init; }

    /// <summary>Jornada vigente no dia (nula se o membro não tinha jornada).</summary>
    public ResolvedSchedule? Schedule { get; init; }

    public bool IsWorkDay { get; init; }

    /// <summary>
    /// O previsto do dia conta: o dia não é posterior a hoje e o membro estava ativo nele. Quando <c>false</c>,
    /// <see cref="ExpectedMinutes"/> é 0 e o dia não é <see cref="Missing"/> (R-09, atualização).
    /// </summary>
    public bool CountsExpected { get; init; } = true;

    public int ExpectedMinutes { get; init; }
    public int WorkedMinutes { get; init; }
    public int BalanceMinutes => WorkedMinutes - ExpectedMinutes;

    /// <summary>Número ímpar de marcações que contam: a última sem par é ignorada no total.</summary>
    public bool Incomplete { get; init; }

    /// <summary>Dia útil, com previsto que conta, sem nenhuma marcação efetiva.</summary>
    public bool Missing { get; init; }

    public bool HasPending { get; init; }

    /// <summary>Todas as marcações do dia (todos os status), por horário, com o período associado.</summary>
    public IReadOnlyList<EvaluatedPunch> Punches { get; init; } = Array.Empty<EvaluatedPunch>();

    /// <summary>Períodos da jornada do dia com a marcação efetiva associada (ou nula).</summary>
    public IReadOnlyList<PeriodSlot> Periods { get; init; } = Array.Empty<PeriodSlot>();
}

/// <summary>Marcação do dia com o período calculado; <see cref="Period"/> nulo = extra ou não efetiva.</summary>
public sealed record EvaluatedPunch(Punch Punch, ResolvedPeriod? Period);

public sealed record PeriodSlot(ResolvedPeriod Period, Punch? Punch);
