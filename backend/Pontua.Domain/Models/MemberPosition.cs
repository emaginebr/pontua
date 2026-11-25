namespace Pontua.Domain.Models;

/// <summary>Cargo do membro com vigência (R-08). Cargo em D = linha com maior <c>EffectiveFrom ≤ D</c>.</summary>
public class MemberPosition
{
    public long MemberPositionId { get; set; }
    public long MemberId { get; set; }
    public long PositionId { get; set; }

    /// <summary>Data local da empresa.</summary>
    public DateOnly EffectiveFrom { get; set; }

    public long CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Position? Position { get; set; }
}
