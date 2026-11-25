using Pontua.DTO.Auth;

namespace Pontua.Infra.Interfaces.AppServices;

/// <summary>Validação do ID token do login Google (R-02).</summary>
public interface IGoogleTokenAppService
{
    /// <summary>
    /// Valida assinatura, emissor, expiração, <c>aud</c> = <c>Google:ClientId</c> e e-mail verificado.
    /// Token inválido → nulo.
    /// </summary>
    Task<GoogleUserInfo?> ValidateAsync(string idToken);
}
