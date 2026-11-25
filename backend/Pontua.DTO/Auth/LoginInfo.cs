using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Entrada por e-mail e senha (<c>POST /api/auth/login</c>).</summary>
public class LoginInfo
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
