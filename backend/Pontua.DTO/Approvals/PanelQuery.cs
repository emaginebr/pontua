using System.Text.Json.Serialization;
using Pontua.DTO.Common;

namespace Pontua.DTO.Approvals;

/// <summary>
/// Filtro do painel de pendências (FR-023): intervalo (<see cref="DateRangeQuery"/>), situação
/// (<c>all</c> padrão, <c>missing</c> ou <c>pending</c>) e cargo (cargo vigente do membro em cada dia).
/// </summary>
public class PanelQuery : DateRangeQuery
{
    public const string TYPE_ALL = "all";
    public const string TYPE_MISSING = "missing";
    public const string TYPE_PENDING = "pending";

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("positionId")]
    public long? PositionId { get; set; }
}
