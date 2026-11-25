using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Resultado de cadastro/entrada: JWT da API e dados do usuário.</summary>
public class AuthResult
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    /// <summary>Expiração do token (UTC).</summary>
    [JsonPropertyName("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    /// <summary>Conta criada nesta requisição.</summary>
    [JsonPropertyName("isNewUser")]
    public bool IsNewUser { get; set; }

    [JsonPropertyName("user")]
    public UserInfo User { get; set; } = new();
}
