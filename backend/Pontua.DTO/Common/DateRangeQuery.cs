using System.Text.Json.Serialization;

namespace Pontua.DTO.Common;

/// <summary>
/// Filtro de datas comum às listagens (R-14): <c>?month=yyyy-MM</c> ou <c>?start=yyyy-MM-dd&amp;end=yyyy-MM-dd</c>
/// (inclusivos). Sem parâmetros → mês corrente no fuso da empresa.
/// </summary>
public class DateRangeQuery
{
    [JsonPropertyName("month")]
    public string? Month { get; set; }

    [JsonPropertyName("start")]
    public string? Start { get; set; }

    [JsonPropertyName("end")]
    public string? End { get; set; }
}
