namespace Pontua.DTO.Settings;

/// <summary>
/// Seção <c>Google</c>. O login com Google é opcional: sem <c>Google:ClientId</c> (vazio ou só espaços) a API sobe
/// normalmente e <c>POST /api/auth/google</c> responde 404 "login com Google desabilitado".
/// </summary>
public class GoogleSettings
{
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Login com Google habilitado neste ambiente (há <see cref="ClientId"/> configurado).</summary>
    public bool IsEnabled => !string.IsNullOrWhiteSpace(ClientId);
}
