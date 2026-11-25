namespace Pontua.Domain.Models;

/// <summary>Resumo de uma semana (segunda a domingo) dentro do filtro (R-09) — objeto calculado.</summary>
public sealed class WeekSummary
{
    /// <summary>Segunda-feira da semana.</summary>
    public DateOnly WeekStart { get; init; }

    /// <summary>Primeiro dia da semana dentro do filtro.</summary>
    public DateOnly From { get; init; }

    /// <summary>Último dia da semana dentro do filtro.</summary>
    public DateOnly To { get; init; }

    /// <summary>Semana cortada pelo filtro.</summary>
    public bool Partial { get; init; }

    public int WorkedMinutes { get; init; }
    public int ExpectedMinutes { get; init; }
    public int BalanceMinutes => WorkedMinutes - ExpectedMinutes;
}
