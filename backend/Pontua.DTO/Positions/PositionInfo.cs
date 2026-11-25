using System.Text.Json.Serialization;
using Pontua.DTO.Schedules;

namespace Pontua.DTO.Positions;

/// <summary>Cargo com a jornada vigente hoje e o número de membros ativos nele hoje.</summary>
public class PositionInfo
{
    [JsonPropertyName("positionId")]
    public long PositionId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("activeMembers")]
    public int ActiveMembers { get; set; }

    /// <summary>Versão vigente hoje (nula só se todas as versões começarem no futuro).</summary>
    [JsonPropertyName("currentSchedule")]
    public ScheduleInfo? CurrentSchedule { get; set; }

    /// <summary>Todas as versões, da mais recente para a mais antiga — só no detalhe (<c>GET .../positions/{id}</c>).</summary>
    [JsonPropertyName("scheduleHistory")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ScheduleInfo>? ScheduleHistory { get; set; }
}
