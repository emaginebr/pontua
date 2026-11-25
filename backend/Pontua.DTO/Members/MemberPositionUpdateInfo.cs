using System.Text.Json.Serialization;

namespace Pontua.DTO.Members;

/// <summary>Mudança de cargo do membro (FR-012): vale a partir de <see cref="EffectiveFrom"/> (padrão hoje; não passada).</summary>
public class MemberPositionUpdateInfo
{
    [JsonPropertyName("positionId")]
    public long? PositionId { get; set; }

    [JsonPropertyName("effectiveFrom")]
    public DateOnly? EffectiveFrom { get; set; }
}
