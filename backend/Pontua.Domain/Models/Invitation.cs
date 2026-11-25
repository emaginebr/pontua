namespace Pontua.Domain.Models;

/// <summary>Convite reutilizável por link (R-13).</summary>
public class Invitation
{
    public long InvitationId { get; set; }
    public long CompanyId { get; set; }
    public long PositionId { get; set; }

    /// <summary>32 bytes aleatórios em base64url (43 caracteres).</summary>
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public int AcceptedCount { get; set; }
    public long CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
