using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

/// <summary>Versão de jornada; <see cref="Days"/> vem sempre expandido por dia útil, nos dois modos.</summary>
public class ScheduleInfo
{
    [JsonPropertyName("scheduleId")]
    public long ScheduleId { get; set; }

    /// <summary><c>weekly</c> ou <c>daily</c>.</summary>
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = string.Empty;

    [JsonPropertyName("effectiveFrom")]
    public DateOnly EffectiveFrom { get; set; }

    [JsonPropertyName("weeklyMinutes")]
    public int WeeklyMinutes { get; set; }

    [JsonPropertyName("days")]
    public List<ScheduleDayInfo> Days { get; set; } = new();

    /// <summary>
    /// Só em versões de jornada de membro que encerram a jornada própria e voltam à do cargo (<c>true</c>);
    /// omitido nas demais.
    /// </summary>
    [JsonPropertyName("inheritsPosition")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? InheritsPosition { get; set; }
}
