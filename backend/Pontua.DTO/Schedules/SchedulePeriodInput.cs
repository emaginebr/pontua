using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

/// <summary>Período de marcação (Entrada, Pausa…); a ordem da lista define a sequência.</summary>
public class SchedulePeriodInput
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Horário previsto <c>HH:mm</c>; nulo em jornada flexível.</summary>
    [JsonPropertyName("expectedTime")]
    public TimeOnly? ExpectedTime { get; set; }
}
