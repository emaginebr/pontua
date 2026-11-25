using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

/// <summary>Dia útil da jornada no modo diário.</summary>
public class ScheduleDayInput
{
    /// <summary>0 = domingo … 6 = sábado.</summary>
    [JsonPropertyName("dayOfWeek")]
    public int DayOfWeek { get; set; }

    [JsonPropertyName("dailyMinutes")]
    public int DailyMinutes { get; set; }

    [JsonPropertyName("periods")]
    public List<SchedulePeriodInput> Periods { get; set; } = new();
}
