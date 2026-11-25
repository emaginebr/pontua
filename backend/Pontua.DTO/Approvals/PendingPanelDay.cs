using System.Text.Json.Serialization;

namespace Pontua.DTO.Approvals;

/// <summary>Dia do painel de pendências (FR-023), com os membros em situação <c>missing</c> ou <c>pending</c>.</summary>
public class PendingPanelDay
{
    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    /// <summary>Membros por nome.</summary>
    [JsonPropertyName("members")]
    public List<PendingPanelMember> Members { get; set; } = new();
}
