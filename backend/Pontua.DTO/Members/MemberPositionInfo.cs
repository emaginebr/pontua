using System.Text.Json.Serialization;

namespace Pontua.DTO.Members;

/// <summary>Vigência de cargo do membro (<c>member_positions</c>).</summary>
public class MemberPositionInfo
{
    [JsonPropertyName("positionId")]
    public long PositionId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("effectiveFrom")]
    public DateOnly EffectiveFrom { get; set; }
}
