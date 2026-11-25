namespace Pontua.Domain.Models;

/// <summary>Cargo supervisionado por um gestor (FR-022c).</summary>
public class ManagerPosition
{
    public long ManagerPositionId { get; set; }
    public long MemberId { get; set; }
    public long PositionId { get; set; }
    public DateTime CreatedAt { get; set; }
}
