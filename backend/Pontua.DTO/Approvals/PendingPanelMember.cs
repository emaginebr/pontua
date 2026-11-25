using System.Text.Json.Serialization;
using Pontua.DTO.Punches;

namespace Pontua.DTO.Approvals;

/// <summary>Membro num dia do painel, com todas as marcações do dia (todos os status).</summary>
public class PendingPanelMember
{
    public const string SITUATION_MISSING = "missing";
    public const string SITUATION_PENDING = "pending";

    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Nome do cargo vigente do membro no dia.</summary>
    [JsonPropertyName("position")]
    public string? Position { get; set; }

    /// <summary><c>missing</c> (dia útil sem marcação efetiva) ou <c>pending</c> (alguma marcação pendente).</summary>
    [JsonPropertyName("situation")]
    public string Situation { get; set; } = string.Empty;

    [JsonPropertyName("isWorkDay")]
    public bool IsWorkDay { get; set; }

    /// <summary>Marcações do dia por horário, com tipo, status, justificativa e motivo da pendência.</summary>
    [JsonPropertyName("punches")]
    public List<PunchInfo> Punches { get; set; } = new();
}
