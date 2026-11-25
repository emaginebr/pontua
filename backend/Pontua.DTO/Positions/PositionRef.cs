using System.Text.Json.Serialization;

namespace Pontua.DTO.Positions;

/// <summary>Referência curta a um cargo (<c>{ positionId, name }</c>) usada em convites e membros.</summary>
public class PositionRef
{
    [JsonPropertyName("positionId")]
    public long PositionId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
