using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Approvals;
using Pontua.DTO.Punches;

namespace Pontua.API.Controllers;

/// <summary>Painel de pendências e análise (aprovação/rejeição) de marcações pelo responsável ou gestor.</summary>
[ApiController]
[Route("api/companies/{companyId:long}")]
[Authorize]
[Produces("application/json")]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalService _approvalService;

    public ApprovalsController(IApprovalService approvalService)
    {
        _approvalService = approvalService;
    }

    /// <summary>
    /// Painel de pendências por dia (FR-023): membros sem marcação em dia útil (<c>missing</c>) e com marcações
    /// pendentes (<c>pending</c>), com todas as marcações do dia. Responsável: todos os membros; gestor: só os membros
    /// dos seus cargos. Dias decrescentes; membros por nome.
    /// </summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="query"><c>month</c> ou <c>start</c>/<c>end</c> (padrão mês corrente), <c>type</c>
    /// (<c>all</c>, <c>missing</c>, <c>pending</c>) e <c>positionId</c>.</param>
    /// <response code="400">Filtro de datas ou tipo inválido.</response>
    /// <response code="403">Membro comum (nem responsável nem gestor).</response>
    [HttpGet("approvals")]
    [ProducesResponseType(typeof(List<PendingPanelDay>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPanel(long companyId, [FromQuery] PanelQuery query)
    {
        try
        {
            return Ok(await _approvalService.GetPanelAsync(companyId, User.GetUserId(), query));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Aprova uma marcação pendente (FR-024). Aprovar uma correção marca a original como <c>superseded</c>.
    /// </summary>
    /// <response code="200">Marcação aprovada, com <c>review</c>.</response>
    /// <response code="400">Observação com mais de 500 caracteres.</response>
    /// <response code="403">Gestor analisando a própria marcação ou marcação de membro fora dos seus cargos.</response>
    /// <response code="404">Marcação inexistente ou empresa sem vínculo ativo.</response>
    /// <response code="409">A marcação não está pendente ou a original já foi substituída.</response>
    [HttpPost("punches/{punchId:long}/approve")]
    [ProducesResponseType(typeof(PunchInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve(long companyId, long punchId, [FromBody] ReviewInsertInfo? info)
    {
        try
        {
            return Ok(await _approvalService.ApproveAsync(companyId, User.GetUserId(), punchId, info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Rejeita uma marcação pendente, com motivo opcional em <c>note</c> (FR-024).</summary>
    /// <response code="200">Marcação rejeitada, com <c>review</c>.</response>
    /// <response code="400">Observação com mais de 500 caracteres.</response>
    /// <response code="403">Gestor analisando a própria marcação ou marcação de membro fora dos seus cargos.</response>
    /// <response code="404">Marcação inexistente ou empresa sem vínculo ativo.</response>
    /// <response code="409">A marcação não está pendente.</response>
    [HttpPost("punches/{punchId:long}/reject")]
    [ProducesResponseType(typeof(PunchInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reject(long companyId, long punchId, [FromBody] ReviewInsertInfo? info)
    {
        try
        {
            return Ok(await _approvalService.RejectAsync(companyId, User.GetUserId(), punchId, info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
