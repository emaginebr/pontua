using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Dados públicos da conta (nunca inclui o hash da senha).</summary>
public class UserInfo
{
    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("hasPassword")]
    public bool HasPassword { get; set; }

    [JsonPropertyName("hasGoogle")]
    public bool HasGoogle { get; set; }
}
