using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>Entrada com a conta Google (<c>POST /api/auth/google</c>): ID token emitido pelo Google no frontend.</summary>
public class GoogleLoginInfo
{
    [JsonPropertyName("idToken")]
    public string IdToken { get; set; } = string.Empty;
}
