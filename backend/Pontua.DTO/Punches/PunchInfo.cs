using System.Text.Json.Serialization;

namespace Pontua.DTO.Punches;

/// <summary>Marcação de ponto (contracts/api.md › Punches). Enums como string camelCase.</summary>
public class PunchInfo
{
    [JsonPropertyName("punchId")]
    public long PunchId { get; set; }

    [JsonPropertyName("nsr")]
    public long Nsr { get; set; }

    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    /// <summary><c>normal</c>, <c>manual</c> ou <c>offline</c>.</summary>
    [JsonPropertyName("kind")]
    public string Kind { get; set; } = string.Empty;

    [JsonPropertyName("punchedAt")]
    public DateTime PunchedAt { get; set; }

    /// <summary>Dia local na empresa.</summary>
    [JsonPropertyName("workDate")]
    public DateOnly WorkDate { get; set; }

    /// <summary>Horário local na empresa (<c>HH:mm</c>).</summary>
    [JsonPropertyName("localTime")]
    public TimeOnly LocalTime { get; set; }

    [JsonPropertyName("receivedAt")]
    public DateTime ReceivedAt { get; set; }

    /// <summary><c>valid</c>, <c>pending</c>, <c>approved</c>, <c>rejected</c>, <c>cancelled</c> ou <c>superseded</c>.</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary><c>manual</c>, <c>outsideWorkday</c>, <c>offline</c> ou nulo.</summary>
    [JsonPropertyName("pendingReason")]
    public string? PendingReason { get; set; }

    [JsonPropertyName("justification")]
    public string? Justification { get; set; }

    [JsonPropertyName("replacesPunchId")]
    public long? ReplacesPunchId { get; set; }

    /// <summary>Período calculado na leitura (R-07); nulo = extra ou marcação não efetiva.</summary>
    [JsonPropertyName("periodName")]
    public string? PeriodName { get; set; }

    [JsonPropertyName("countsAsWorked")]
    public bool CountsAsWorked { get; set; }

    /// <summary>Última análise (aprovação ou rejeição); nula se não houver.</summary>
    [JsonPropertyName("review")]
    public ReviewInfo? Review { get; set; }

    /// <summary>Histórico de status — só no detalhe (<c>GET .../punches/{punchId}</c>).</summary>
    [JsonPropertyName("statusHistory")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<PunchStatusChangeInfo>? StatusHistory { get; set; }
}

/// <summary>Quem analisou a marcação, quando e com qual observação.</summary>
public class ReviewInfo
{
    [JsonPropertyName("by")]
    public string By { get; set; } = string.Empty;

    [JsonPropertyName("at")]
    public DateTime At { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}

/// <summary>Linha do histórico de status (FR-025); <see cref="FromStatus"/> nulo na criação.</summary>
public class PunchStatusChangeInfo
{
    [JsonPropertyName("fromStatus")]
    public string? FromStatus { get; set; }

    [JsonPropertyName("toStatus")]
    public string ToStatus { get; set; } = string.Empty;

    /// <summary>Nome de quem fez a mudança.</summary>
    [JsonPropertyName("changedBy")]
    public string ChangedBy { get; set; } = string.Empty;

    [JsonPropertyName("changedAt")]
    public DateTime ChangedAt { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}
