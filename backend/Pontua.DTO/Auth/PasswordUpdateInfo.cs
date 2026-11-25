using System.Text.Json.Serialization;

namespace Pontua.DTO.Auth;

/// <summary>
/// Troca ou definição de senha (<c>PUT /api/auth/me/password</c>). <see cref="CurrentPassword"/> é obrigatório
/// quando a conta já tem senha (conta só-Google pode definir a primeira senha sem ela).
/// </summary>
public class PasswordUpdateInfo
{
    [JsonPropertyName("currentPassword")]
    public string? CurrentPassword { get; set; }

    [JsonPropertyName("newPassword")]
    public string NewPassword { get; set; } = string.Empty;
}
