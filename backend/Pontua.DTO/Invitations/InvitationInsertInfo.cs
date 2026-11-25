using System.Text.Json.Serialization;

namespace Pontua.DTO.Invitations;

/// <summary>Criação de convite (<c>POST .../invitations</c>, só o responsável).</summary>
public class InvitationInsertInfo
{
    public const int DEFAULT_EXPIRES_IN_DAYS = 7;
    public const int MIN_EXPIRES_IN_DAYS = 1;
    public const int MAX_EXPIRES_IN_DAYS = 30;

    [JsonPropertyName("positionId")]
    public long? PositionId { get; set; }

    /// <summary>Validade em dias (1–30, padrão 7).</summary>
    [JsonPropertyName("expiresInDays")]
    public int? ExpiresInDays { get; set; }
}
