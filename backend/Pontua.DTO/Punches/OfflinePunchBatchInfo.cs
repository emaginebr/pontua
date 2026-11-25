using System.Text.Json.Serialization;

namespace Pontua.DTO.Punches;

/// <summary>Lote de marcações feitas sem conexão (R-10): 1 a 50 itens.</summary>
public class OfflinePunchBatchInfo
{
    public const int MAX_ITEMS = 50;

    [JsonPropertyName("items")]
    public List<OfflinePunchItem>? Items { get; set; }
}

/// <summary>Marcação offline: identificador gerado no aparelho (uuid) e instante ISO-8601 com offset.</summary>
public class OfflinePunchItem
{
    [JsonPropertyName("clientId")]
    public string? ClientId { get; set; }

    /// <summary>Instante do aparelho, ISO-8601 com offset (ex.: <c>2026-11-25T08:02:41-03:00</c> ou <c>...Z</c>).</summary>
    [JsonPropertyName("punchedAt")]
    public string? PunchedAt { get; set; }
}

/// <summary>Resultado da sincronização offline, item a item, na ordem do lote.</summary>
public class OfflineSyncResult
{
    [JsonPropertyName("items")]
    public List<OfflineSyncItemResult> Items { get; set; } = new();
}

/// <summary>Resultado de um item do lote offline.</summary>
public class OfflineSyncItemResult
{
    public const string CREATED = "created";
    public const string DUPLICATE = "duplicate";
    public const string FUTURE = "future";
    public const string TOO_OLD = "too_old";

    [JsonPropertyName("clientId")]
    public string ClientId { get; set; } = string.Empty;

    /// <summary><c>created</c>, <c>duplicate</c>, <c>future</c> ou <c>too_old</c>.</summary>
    [JsonPropertyName("result")]
    public string Result { get; set; } = string.Empty;

    /// <summary>Marcação gravada (<c>created</c>) ou já existente (<c>duplicate</c>); nula nas recusas.</summary>
    [JsonPropertyName("punch")]
    public PunchInfo? Punch { get; set; }
}
