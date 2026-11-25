using System.Text.Json.Serialization;

namespace Pontua.DTO.Schedules;

/// <summary>
/// Jornada de trabalho a gravar como nova versão (FR-009 a FR-012). No modo <c>weekly</c> usa
/// <see cref="WorkDays"/>, <see cref="DailyMinutes"/> e <see cref="Periods"/>; no modo <c>daily</c> usa
/// <see cref="Days"/>.
/// </summary>
public class ScheduleInput
{
    public const string MODE_WEEKLY = "weekly";
    public const string MODE_DAILY = "daily";

    /// <summary><c>weekly</c> ou <c>daily</c>.</summary>
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = string.Empty;

    /// <summary>Início da vigência (data local da empresa); padrão hoje; não pode ser passado.</summary>
    [JsonPropertyName("effectiveFrom")]
    public DateOnly? EffectiveFrom { get; set; }

    /// <summary>Carga semanal em minutos (1–10080).</summary>
    [JsonPropertyName("weeklyMinutes")]
    public int WeeklyMinutes { get; set; }

    /// <summary>Só no modo semanal: dias úteis (0 = domingo … 6 = sábado).</summary>
    [JsonPropertyName("workDays")]
    public List<int>? WorkDays { get; set; }

    /// <summary>Só no modo semanal: carga diária em minutos (1–1440).</summary>
    [JsonPropertyName("dailyMinutes")]
    public int? DailyMinutes { get; set; }

    /// <summary>Só no modo semanal: períodos comuns a todos os dias úteis.</summary>
    [JsonPropertyName("periods")]
    public List<SchedulePeriodInput>? Periods { get; set; }

    /// <summary>Só no modo diário: um item por dia útil.</summary>
    [JsonPropertyName("days")]
    public List<ScheduleDayInput>? Days { get; set; }
}
