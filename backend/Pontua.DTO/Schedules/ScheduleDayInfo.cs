using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

public class ScheduleDayInfo
{
    /// <summary>0 = domingo … 6 = sábado.</summary>
    [JsonPropertyName("dayOfWeek")]
    public int DayOfWeek { get; set; }

    [JsonPropertyName("dailyMinutes")]
    public int DailyMinutes { get; set; }

    [JsonPropertyName("periods")]
    public List<SchedulePeriodInfo> Periods { get; set; } = new();
}
