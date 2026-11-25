using Pontua.Domain.Enums;

namespace Pontua.Domain.Models;

/// <summary>Vínculo de um usuário com uma empresa.</summary>
public class Member
{
    public long MemberId { get; set; }
    public long CompanyId { get; set; }
    public long UserId { get; set; }
    public MemberStatus Status { get; set; } = MemberStatus.Active;
    public bool IsManager { get; set; }

    /// <summary>Primeiro ingresso (UTC).</summary>
    public DateTime JoinedAt { get; set; }

    /// <summary>Data local da última ativação (ingresso ou reativação).</summary>
    public DateOnly ActiveSince { get; set; }

    public DateTime? DeactivatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User? User { get; set; }

    public bool IsActive => Status == MemberStatus.Active;
}
