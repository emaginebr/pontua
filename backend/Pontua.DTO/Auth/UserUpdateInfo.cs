using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Atualização do próprio nome (<c>PUT /api/auth/me</c>).</summary>
public class UserUpdateInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
