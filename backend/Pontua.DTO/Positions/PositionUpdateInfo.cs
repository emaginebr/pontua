using System.Text.Json.Serialization;

namespace Pontua.DTO.Positions;

/// <summary>Renomear cargo (a jornada muda por <c>PUT .../schedule</c>).</summary>
public class PositionUpdateInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
