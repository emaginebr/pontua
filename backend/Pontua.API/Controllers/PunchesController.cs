using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Common;
using Pontua.DTO.Punches;

namespace Pontua.API.Controllers;

/// <summary>Marcações de ponto: registro normal, offline e manual, cancelamento, histórico por dia e detalhe.</summary>
[ApiController]
[Route("api/companies/{companyId:long}")]
[Authorize]
[Produces("application/json")]
public class PunchesController : ControllerBase
{
    private readonly IPunchService _punchService;

    public PunchesController(IPunchService punchService)
    {
        _punchService = punchService;
    }

    /// <summary>
    /// Marcação normal com o horário do servidor (sem corpo). Dia útil → <c>valid</c>; fora do dia útil →
    /// <c>pending</c> (<c>outsideWorkday</c>).
    /// </summary>
    /// <response code="201">Marcação gravada, com o período calculado em <c>periodName</c>.</response>
    /// <response code="422">Menos de 1 minuto após a marcação anterior.</response>
    [HttpPost("punches")]
    [ProducesResponseType(typeof(PunchInfo), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Punch(long companyId)
    {
        try
        {
            var punch = await _punchService.PunchAsync(companyId, User.GetUserId());
            return CreatedAtAction(nameof(Get), new { companyId, punchId = punch.PunchId }, punch);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Sincroniza até 50 marcações feitas sem conexão. Resultado por item: <c>created</c>, <c>duplicate</c>
    /// (mesmo <c>clientId</c>), <c>future</c> ou <c>too_old</c>.
    /// </summary>
    [HttpPost("punches/offline")]
    [ProducesResponseType(typeof(OfflineSyncResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SyncOffline(long companyId, [FromBody] OfflinePunchBatchInfo batch)
    {
        try
        {
            return Ok(await _punchService.SyncOfflineAsync(companyId, User.GetUserId(), batch));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Marcação manual com justificativa (inclusão de esquecida ou, com <c>replacesPunchId</c>, correção). Fica
    /// <c>pending</c> (<c>manual</c>) e não conta nas horas até ser aprovada. Uma nova correção da mesma original
    /// cancela a correção pendente anterior.
    /// </summary>
    /// <response code="201">Marcação manual gravada.</response>
    /// <response code="400">Data, horário ou justificativa (5–500 caracteres) inválidos.</response>
    /// <response code="404">Empresa sem vínculo ativo ou marcação a corrigir inexistente.</response>
    /// <response code="409">A marcação a corrigir não é do chamador ou não está válida/aprovada.</response>
    /// <response code="422">Horário no futuro ou data anterior ao limite retroativo da empresa.</response>
    [HttpPost("punches/manual")]
    [ProducesResponseType(typeof(PunchInfo), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CreateManual(long companyId, [FromBody] ManualPunchInsertInfo info)
    {
        try
        {
            var punch = await _punchService.CreateManualAsync(companyId, User.GetUserId(), info);
            return CreatedAtAction(nameof(Get), new { companyId, punchId = punch.PunchId }, punch);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Cancela uma marcação manual pendente do próprio chamador (FR-020).</summary>
    /// <response code="204">Marcação cancelada.</response>
    /// <response code="403">A marcação não foi registrada pelo chamador.</response>
    /// <response code="404">Marcação inexistente ou empresa sem vínculo ativo.</response>
    /// <response code="409">A marcação não é manual ou não está pendente.</response>
    [HttpPost("punches/{punchId:long}/cancel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(long companyId, long punchId)
    {
        try
        {
            await _punchService.CancelAsync(companyId, User.GetUserId(), punchId);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Histórico por dia do chamador (todos os dias do período, inclusive sem marcações).</summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="query"><c>month</c> ou <c>start</c>/<c>end</c>; padrão mês corrente.</param>
    [HttpGet("punches/me")]
    [ProducesResponseType(typeof(List<DayRecord>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyDays(long companyId, [FromQuery] DateRangeQuery query)
    {
        try
        {
            return Ok(await _punchService.GetMyDaysAsync(companyId, User.GetUserId(), query));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Histórico por dia de um membro (o próprio, o responsável ou o gestor do cargo do membro).</summary>
    [HttpGet("members/{memberId:long}/punches")]
    [ProducesResponseType(typeof(List<DayRecord>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMemberDays(long companyId, long memberId, [FromQuery] DateRangeQuery query)
    {
        try
        {
            return Ok(await _punchService.GetDaysAsync(companyId, User.GetUserId(), memberId, query));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Marcação com o histórico de status (o autor, o responsável ou o gestor do cargo do autor).</summary>
    [HttpGet("punches/{punchId:long}")]
    [ProducesResponseType(typeof(PunchInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(long companyId, long punchId)
    {
        try
        {
            return Ok(await _punchService.GetPunchAsync(companyId, User.GetUserId(), punchId));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
