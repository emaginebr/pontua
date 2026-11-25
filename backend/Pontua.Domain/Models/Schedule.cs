using Pontua.Domain.Enums;

namespace Pontua.Domain.Models;

/// <summary>
/// Versão de jornada (R-08), pertencente a um cargo <b>ou</b> a um membro. Versões passadas são imutáveis;
/// alterar a jornada = inserir nova versão.
/// </summary>
public class Schedule
{
    public long ScheduleId { get; set; }
    public long CompanyId { get; set; }
    public long? PositionId { get; set; }
    public long? MemberId { get; set; }

    /// <summary>Só para membro: <c>true</c> encerra a jornada própria e volta a usar a do cargo.</summary>
    public bool InheritsPosition { get; set; }

    /// <summary>Ignorado quando <see cref="InheritsPosition"/>.</summary>
    public ScheduleMode Mode { get; set; } = ScheduleMode.Weekly;

    public int WeeklyMinutes { get; set; }

    /// <summary>Data local da empresa.</summary>
    public DateOnly EffectiveFrom { get; set; }

    public long CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Somente os dias úteis.</summary>
    public List<ScheduleDay> Days { get; set; } = new();

    public List<SchedulePeriod> Periods { get; set; } = new();
}
