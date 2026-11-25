namespace Pontua.Domain.Models;

/// <summary>Cargo da empresa.</summary>
public class Position
{
    public long PositionId { get; set; }
    public long CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
