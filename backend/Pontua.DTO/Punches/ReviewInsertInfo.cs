using System.Text.Json.Serialization;

namespace Pontua.DTO.Punches;

/// <summary>Aprovação ou rejeição de uma marcação pendente (FR-024): observação opcional (≤ 500).</summary>
public class ReviewInsertInfo
{
    public const int NOTE_MAX_LENGTH = 500;

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}
