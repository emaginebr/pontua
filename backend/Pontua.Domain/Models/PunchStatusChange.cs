using Pontua.Domain.Enums;

namespace Pontua.Domain.Models;

/// <summary>Histórico de status de uma marcação (FR-025). <see cref="FromStatus"/> é nulo na criação.</summary>
public class PunchStatusChange
{
    public long PunchStatusChangeId { get; set; }
    public long PunchId { get; set; }
    public PunchStatus? FromStatus { get; set; }
    public PunchStatus ToStatus { get; set; }
    public long ChangedByUserId { get; set; }
    public string? Note { get; set; }
    public DateTime ChangedAt { get; set; }
}
