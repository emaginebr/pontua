using System.Text.Json.Serialization;

namespace Pontua.DTO.Punches;

/// <summary>Histórico de um dia do membro. Dias sem marcação também aparecem (<c>punches: []</c>).</summary>
public class DayRecord
{
    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("isWorkDay")]
    public bool IsWorkDay { get; set; }

    [JsonPropertyName("expectedMinutes")]
    public int ExpectedMinutes { get; set; }

    [JsonPropertyName("workedMinutes")]
    public int WorkedMinutes { get; set; }

    [JsonPropertyName("balanceMinutes")]
    public int BalanceMinutes { get; set; }

    [JsonPropertyName("incomplete")]
    public bool Incomplete { get; set; }

    [JsonPropertyName("hasPending")]
    public bool HasPending { get; set; }

    [JsonPropertyName("periods")]
    public List<DayPeriodInfo> Periods { get; set; } = new();

    /// <summary>Todas as marcações do dia, de todos os status, ordenadas por horário.</summary>
    [JsonPropertyName("punches")]
    public List<PunchInfo> Punches { get; set; } = new();
}

/// <summary>Período previsto do dia com a marcação efetiva associada (nula se ainda não marcado).</summary>
public class DayPeriodInfo
{
    [JsonPropertyName("sequence")]
    public int Sequence { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("expectedTime")]
    public TimeOnly? ExpectedTime { get; set; }

    [JsonPropertyName("punchId")]
    public long? PunchId { get; set; }
}
