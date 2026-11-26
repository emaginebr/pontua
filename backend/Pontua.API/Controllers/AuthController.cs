using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Auth;

namespace Pontua.API.Controllers;

/// <summary>Cadastro, entrada (e-mail+senha e Google) e dados da própria conta.</summary>
[ApiController]
[Route("api/auth")]
[Authorize]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Cria a conta por e-mail e senha (senha com no mínimo 8 caracteres).</summary>
    /// <response code="201">Conta criada; já devolve o token.</response>
    /// <response code="400">Dados inválidos.</response>
    /// <response code="409">E-mail já em uso.</response>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterInfo info)
    {
        try
        {
            var result = await _authService.RegisterAsync(info);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Entra com e-mail e senha.</summary>
    /// <response code="200">Token emitido.</response>
    /// <response code="401">"E-mail ou senha inválidos." (também para conta que só usa Google).</response>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginInfo info)
    {
        try
        {
            return Ok(await _authService.LoginAsync(info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Entra com a conta Google (ID token); cria a conta ou vincula a uma existente com o mesmo e-mail.</summary>
    /// <response code="200">Token emitido (<c>isNewUser</c> quando a conta foi criada agora).</response>
    /// <response code="401">Token do Google inválido.</response>
    /// <response code="404">"Login com Google não está habilitado neste ambiente." (<c>Google:ClientId</c> não configurado).</response>
    [HttpPost("google")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Google([FromBody] GoogleLoginInfo info)
    {
        try
        {
            return Ok(await _authService.GoogleLoginAsync(info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Dados da conta autenticada.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe()
    {
        try
        {
            return Ok(await _authService.GetMeAsync(User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Atualiza o nome da conta autenticada.</summary>
    [HttpPut("me")]
    [ProducesResponseType(typeof(UserInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateMe([FromBody] UserUpdateInfo info)
    {
        try
        {
            return Ok(await _authService.UpdateMeAsync(User.GetUserId(), info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Troca a senha (<c>currentPassword</c> obrigatório se a conta já tiver senha) ou define a primeira.</summary>
    /// <response code="204">Senha alterada.</response>
    /// <response code="400">Nova senha inválida, senha atual ausente ou incorreta.</response>
    [HttpPut("me/password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] PasswordUpdateInfo info)
    {
        try
        {
            await _authService.ChangePasswordAsync(User.GetUserId(), info);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
