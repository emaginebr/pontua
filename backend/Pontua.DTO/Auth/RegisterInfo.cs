using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Cadastro por e-mail e senha (<c>POST /api/auth/register</c>).</summary>
public class RegisterInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
