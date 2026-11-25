using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;

namespace Pontua.API.Controllers;

/// <summary>Cargos da empresa e suas jornadas versionadas.</summary>
[ApiController]
[Route("api/companies/{companyId:long}/positions")]
[Authorize]
[Produces("application/json")]
public class PositionsController : ControllerBase
{
    private readonly IPositionService _positionService;

    public PositionsController(IPositionService positionService)
    {
        _positionService = positionService;
    }

    /// <summary>Cargos com a jornada vigente hoje e o nº de membros ativos (membro ativo).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<PositionInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(long companyId)
    {
        try
        {
            return Ok(await _positionService.ListAsync(companyId, User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Cria o cargo com a jornada vigente a partir de hoje (só o responsável).</summary>
    /// <response code="201">Cargo criado.</response>
    /// <response code="409">Já existe cargo com o mesmo nome.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PositionInfo), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(long companyId, [FromBody] PositionInsertInfo info)
    {
        try
        {
            var position = await _positionService.CreateAsync(companyId, User.GetUserId(), info);
            return CreatedAtAction(nameof(Get), new { companyId, positionId = position.PositionId }, position);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Cargo com o histórico de jornadas (<c>scheduleHistory</c>, da mais recente para a mais antiga).</summary>
    [HttpGet("{positionId:long}")]
    [ProducesResponseType(typeof(PositionInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(long companyId, long positionId)
    {
        try
        {
            return Ok(await _positionService.GetAsync(companyId, User.GetUserId(), positionId));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Renomeia o cargo (só o responsável).</summary>
    [HttpPut("{positionId:long}")]
    [ProducesResponseType(typeof(PositionInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(long companyId, long positionId, [FromBody] PositionUpdateInfo info)
    {
        try
        {
            return Ok(await _positionService.UpdateAsync(companyId, User.GetUserId(), positionId, info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Grava nova versão da jornada do cargo (só o responsável). <c>effectiveFrom</c> padrão hoje; data passada → 422;
    /// mesma data de uma versão existente → substitui.
    /// </summary>
    [HttpPut("{positionId:long}/schedule")]
    [ProducesResponseType(typeof(ScheduleInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SaveSchedule(long companyId, long positionId, [FromBody] ScheduleInput input)
    {
        try
        {
            return Ok(await _positionService.SaveScheduleAsync(companyId, User.GetUserId(), positionId, input));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Exclui um cargo nunca usado (só o responsável).</summary>
    /// <response code="204">Cargo excluído.</response>
    /// <response code="409">Cargo com histórico (membros, convites ou gestores): renomeie-o.</response>
    /// <response code="422">Cargo com membros ativos.</response>
    [HttpDelete("{positionId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Delete(long companyId, long positionId)
    {
        try
        {
            await _positionService.DeleteAsync(companyId, User.GetUserId(), positionId);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
