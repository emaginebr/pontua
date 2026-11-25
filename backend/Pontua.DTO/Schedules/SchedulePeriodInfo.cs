using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

public class SchedulePeriodInfo
{
    /// <summary>Ordem 1..n dentro do dia.</summary>
    [JsonPropertyName("sequence")]
    public int Sequence { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("expectedTime")]
    public TimeOnly? ExpectedTime { get; set; }
}
