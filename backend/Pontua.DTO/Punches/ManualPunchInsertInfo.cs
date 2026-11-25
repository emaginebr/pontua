using System.Text.Json.Serialization;

namespace Pontua.DTO.Punches;

/// <summary>
/// Marcação manual (FR-018): inclusão de marcação esquecida ou, com <see cref="ReplacesPunchId"/>, correção de uma
/// marcação existente. Data e hora no fuso da empresa; fica pendente de aprovação.
/// </summary>
public class ManualPunchInsertInfo
{
    public const int JUSTIFICATION_MIN_LENGTH = 5;
    public const int JUSTIFICATION_MAX_LENGTH = 500;

    /// <summary>Dia local na empresa (<c>yyyy-MM-dd</c>).</summary>
    [JsonPropertyName("workDate")]
    public DateOnly? WorkDate { get; set; }

    /// <summary>Horário local na empresa (<c>HH:mm</c>).</summary>
    [JsonPropertyName("time")]
    public TimeOnly? Time { get; set; }

    /// <summary>Justificativa obrigatória (5–500 caracteres).</summary>
    [JsonPropertyName("justification")]
    public string? Justification { get; set; }

    /// <summary>Marcação corrigida (do próprio membro, <c>valid</c> ou <c>approved</c>); nula para inclusão.</summary>
    [JsonPropertyName("replacesPunchId")]
    public long? ReplacesPunchId { get; set; }
}
