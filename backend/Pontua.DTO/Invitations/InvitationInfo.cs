using System.Text.Json.Serialization;
using Pontua.DTO.Positions;

namespace Pontua.DTO.Invitations;

/// <summary>Convite na visão do responsável, com o link pronto para copiar.</summary>
public class InvitationInfo
{
    [JsonPropertyName("invitationId")]
    public long InvitationId { get; set; }

    [JsonPropertyName("position")]
    public PositionRef Position { get; set; } = new();

    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    /// <summary><c>{App:FrontendBaseUrl}/convite/{token}</c>.</summary>
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    /// <summary><c>active</c>, <c>expired</c> ou <c>revoked</c>.</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [JsonPropertyName("acceptedCount")]
    public int AcceptedCount { get; set; }

    /// <summary>Nome de quem gerou o convite.</summary>
    [JsonPropertyName("createdBy")]
    public string CreatedBy { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}
