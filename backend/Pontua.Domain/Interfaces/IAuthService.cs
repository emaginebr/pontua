using Pontua.DTO.Auth;

namespace Pontua.Domain.Interfaces;

/// <summary>Contas e autenticação (R-02, FR-001).</summary>
public interface IAuthService
{
    /// <summary>Cria a conta por e-mail e senha; e-mail já usado → 409.</summary>
    Task<AuthResult> RegisterAsync(RegisterInfo info);

    /// <summary>Entrada por e-mail e senha; qualquer falha de credencial → 401 genérico.</summary>
    Task<AuthResult> LoginAsync(LoginInfo info);

    /// <summary>Entrada com a conta Google: cria a conta ou vincula por e-mail; token inválido → 401; sem <c>Google:ClientId</c> → 404 (desabilitado).</summary>
    Task<AuthResult> GoogleLoginAsync(GoogleLoginInfo info);

    Task<UserInfo> GetMeAsync(long userId);
    Task<UserInfo> UpdateMeAsync(long userId, UserUpdateInfo info);

    /// <summary>Troca a senha (exige a atual se a conta já tiver senha) ou define a primeira senha.</summary>
    Task ChangePasswordAsync(long userId, PasswordUpdateInfo info);
}
