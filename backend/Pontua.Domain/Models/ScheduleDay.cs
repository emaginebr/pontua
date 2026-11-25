namespace Pontua.Domain.Models;

/// <summary>Dia útil de uma jornada e sua carga diária.</summary>
public class ScheduleDay
{
    public long ScheduleDayId { get; set; }
    public long ScheduleId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public int DailyMinutes { get; set; }
}
