using Pontua.Domain.Enums;

namespace Pontua.Domain.Models;

/// <summary>
/// Jornada efetiva de um membro numa data (R-08) — objeto calculado, não persistido.
/// </summary>
public sealed class ResolvedSchedule
{
    public DateOnly Date { get; init; }

    /// <summary>Versão de jornada aplicada (do membro ou do cargo).</summary>
    public long ScheduleId { get; init; }

    /// <summary>Cargo do membro na data (nulo se ele não tinha cargo).</summary>
    public long? PositionId { get; init; }

    /// <summary><c>true</c> quando a versão aplicada é a jornada própria do membro.</summary>
    public bool IsMemberSchedule { get; init; }

    public ScheduleMode Mode { get; init; }
    public bool IsWorkDay { get; init; }

    /// <summary>Carga diária prevista; 0 em dia não útil.</summary>
    public int DailyMinutes { get; init; }

    public int WeeklyMinutes { get; init; }

    /// <summary>Períodos do dia, ordenados por sequência; vazio em dia não útil.</summary>
    public IReadOnlyList<ResolvedPeriod> Periods { get; init; } = Array.Empty<ResolvedPeriod>();
}

public sealed record ResolvedPeriod(int Sequence, string Name, TimeOnly? ExpectedTime);
