namespace Pontua.DTO.Invitations;

/// <summary>Situação derivada do convite (data-model.md › invitations).</summary>
public static class InvitationStatuses
{
    public const string ACTIVE = "active";
    public const string EXPIRED = "expired";
    public const string REVOKED = "revoked";

    public static readonly IReadOnlyList<string> ALL = new[] { ACTIVE, EXPIRED, REVOKED };
}
