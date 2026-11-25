namespace Pontua.Domain.Models;

/// <summary>Período previsto (Entrada, Pausa…). <see cref="DayOfWeek"/> é nulo no modo semanal.</summary>
public class SchedulePeriod
{
    public long SchedulePeriodId { get; set; }
    public long ScheduleId { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public int Sequence { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Horário previsto local; nulo em jornada flexível.</summary>
    public TimeOnly? ExpectedTime { get; set; }
}
