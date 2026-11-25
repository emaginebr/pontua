namespace Pontua.DTO.Auth;

/// <summary>Dados do usuário extraídos de um ID token do Google já validado (uso interno, não sai na API).</summary>
public class GoogleUserInfo
{
    /// <summary>Claim <c>sub</c>: identificador estável da conta Google.</summary>
    public string Subject { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? Name { get; set; }
}
