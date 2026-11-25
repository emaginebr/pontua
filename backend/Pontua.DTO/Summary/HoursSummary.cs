using System.Text.Json.Serialization;

namespace Pontua.DTO.Summary;

/// <summary>Resumo de horas do membro no período (FR-027, R-09).</summary>
public class HoursSummary
{
    [JsonPropertyName("start")]
    public DateOnly Start { get; set; }

    [JsonPropertyName("end")]
    public DateOnly End { get; set; }

    [JsonPropertyName("totals")]
    public SummaryTotalsInfo Totals { get; set; } = new();

    /// <summary>Semanas de segunda a domingo que cruzam o período.</summary>
    [JsonPropertyName("weeks")]
    public List<WeekSummaryInfo> Weeks { get; set; } = new();

    [JsonPropertyName("days")]
    public List<DaySummaryInfo> Days { get; set; } = new();
}

public class SummaryTotalsInfo
{
    [JsonPropertyName("workedMinutes")]
    public int WorkedMinutes { get; set; }

    /// <summary>Soma do previsto das semanas do período.</summary>
    [JsonPropertyName("expectedMinutes")]
    public int ExpectedMinutes { get; set; }

    [JsonPropertyName("balanceMinutes")]
    public int BalanceMinutes { get; set; }

    /// <summary>Marcações com status <c>pending</c> no período.</summary>
    [JsonPropertyName("pendingPunches")]
    public int PendingPunches { get; set; }
}

public class WeekSummaryInfo
{
    /// <summary>Segunda-feira da semana.</summary>
    [JsonPropertyName("weekStart")]
    public DateOnly WeekStart { get; set; }

    [JsonPropertyName("from")]
    public DateOnly From { get; set; }

    [JsonPropertyName("to")]
    public DateOnly To { get; set; }

    /// <summary>Semana cortada pelo filtro (previsto = soma das cargas diárias dos dias dentro do filtro).</summary>
    [JsonPropertyName("partial")]
    public bool Partial { get; set; }

    [JsonPropertyName("workedMinutes")]
    public int WorkedMinutes { get; set; }

    [JsonPropertyName("expectedMinutes")]
    public int ExpectedMinutes { get; set; }

    [JsonPropertyName("balanceMinutes")]
    public int BalanceMinutes { get; set; }
}

public class DaySummaryInfo
{
    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("isWorkDay")]
    public bool IsWorkDay { get; set; }

    [JsonPropertyName("workedMinutes")]
    public int WorkedMinutes { get; set; }

    [JsonPropertyName("expectedMinutes")]
    public int ExpectedMinutes { get; set; }

    [JsonPropertyName("balanceMinutes")]
    public int BalanceMinutes { get; set; }

    [JsonPropertyName("incomplete")]
    public bool Incomplete { get; set; }
}
