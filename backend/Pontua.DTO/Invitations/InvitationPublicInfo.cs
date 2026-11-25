using System.Text.Json.Serialization;

namespace Pontua.DTO.Invitations;

/// <summary>Dados públicos do convite (<c>GET /api/invitations/{token}</c>, sem autenticação).</summary>
public class InvitationPublicInfo
{
    [JsonPropertyName("companyName")]
    public string CompanyName { get; set; } = string.Empty;

    [JsonPropertyName("positionName")]
    public string PositionName { get; set; } = string.Empty;

    /// <summary><c>active</c>, <c>expired</c> ou <c>revoked</c>.</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; set; }
}
