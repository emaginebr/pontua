using System.Text.Json.Serialization;
using Pontua.DTO.Schedules;

namespace Pontua.DTO.Positions;

/// <summary>Criação de cargo com a jornada inicial (vigência = hoje).</summary>
public class PositionInsertInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("schedule")]
    public ScheduleInput? Schedule { get; set; }
}
