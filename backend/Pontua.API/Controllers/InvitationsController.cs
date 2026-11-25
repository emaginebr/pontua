using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Common;
using Pontua.DTO.Companies;
using Pontua.DTO.Invitations;

namespace Pontua.API.Controllers;

/// <summary>Convites por link: gestão pelo responsável, consulta pública e aceite.</summary>
[ApiController]
[Route("api")]
[Authorize]
[Produces("application/json")]
public class InvitationsController : ControllerBase
{
    private readonly IInvitationService _invitationService;

    public InvitationsController(IInvitationService invitationService)
    {
        _invitationService = invitationService;
    }

    /// <summary>Convites criados no período (só o responsável), opcionalmente filtrados pela situação.</summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="query">Filtro de datas por <c>created_at</c>: <c>month</c> ou <c>start</c>/<c>end</c>; padrão mês corrente.</param>
    /// <param name="status"><c>active</c>, <c>expired</c> ou <c>revoked</c> (opcional).</param>
    [HttpGet("companies/{companyId:long}/invitations")]
    [ProducesResponseType(typeof(List<InvitationInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(long companyId, [FromQuery] DateRangeQuery query, [FromQuery] string? status)
    {
        try
        {
            return Ok(await _invitationService.ListAsync(companyId, User.GetUserId(), query, status));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Gera um link de convite para o cargo (só o responsável); validade de 1 a 30 dias, padrão 7.</summary>
    /// <response code="201">Convite criado, com o link em <c>url</c>.</response>
    [HttpPost("companies/{companyId:long}/invitations")]
    [ProducesResponseType(typeof(InvitationInfo), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(long companyId, [FromBody] InvitationInsertInfo info)
    {
        try
        {
            var invitation = await _invitationService.CreateAsync(companyId, User.GetUserId(), info);
            return StatusCode(StatusCodes.Status201Created, invitation);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Revoga o convite (só o responsável).</summary>
    /// <response code="204">Convite revogado (ou já estava revogado).</response>
    [HttpPost("companies/{companyId:long}/invitations/{invitationId:long}/revoke")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Revoke(long companyId, long invitationId)
    {
        try
        {
            await _invitationService.RevokeAsync(companyId, User.GetUserId(), invitationId);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Consulta pública do convite: empresa, cargo, situação e expiração.</summary>
    /// <response code="404">Token inexistente.</response>
    [HttpGet("invitations/{token}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(InvitationPublicInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPublic(string token)
    {
        try
        {
            return Ok(await _invitationService.GetPublicAsync(token));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Aceita o convite: o usuário vira membro ativo com o cargo do convite (ou é reativado).</summary>
    /// <response code="409">Já é membro ativo da empresa.</response>
    /// <response code="422">Convite expirado ou revogado.</response>
    [HttpPost("invitations/{token}/accept")]
    [ProducesResponseType(typeof(CompanySummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Accept(string token)
    {
        try
        {
            return Ok(await _invitationService.AcceptAsync(token, User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
