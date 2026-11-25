using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Members;
using Pontua.DTO.Schedules;

namespace Pontua.API.Controllers;

/// <summary>Membros da empresa: consultas e administração pelo responsável (cargo, jornada, ativação e gestores).</summary>
[ApiController]
[Route("api/companies/{companyId:long}/members")]
[Authorize]
[Produces("application/json")]
public class MembersController : ControllerBase
{
    private readonly IMemberService _memberService;

    public MembersController(IMemberService memberService)
    {
        _memberService = memberService;
    }

    /// <summary>
    /// Membros por nome (responsável: todos; gestor: só os membros dos seus cargos).
    /// </summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="status"><c>active</c> (padrão), <c>inactive</c> ou <c>all</c>.</param>
    /// <param name="positionId">Filtra pelo cargo vigente hoje (opcional).</param>
    [HttpGet]
    [ProducesResponseType(typeof(List<MemberInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(long companyId, [FromQuery] string? status, [FromQuery] long? positionId)
    {
        try
        {
            return Ok(await _memberService.ListAsync(companyId, User.GetUserId(), status, positionId));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>O membro chamador, com cargo e jornada vigentes hoje.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(MemberInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMe(long companyId)
    {
        try
        {
            return Ok(await _memberService.GetMeAsync(companyId, User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Detalhe do membro com históricos de cargo e de jornada própria (o próprio, o responsável ou o gestor do cargo).</summary>
    [HttpGet("{memberId:long}")]
    [ProducesResponseType(typeof(MemberInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(long companyId, long memberId)
    {
        try
        {
            return Ok(await _memberService.GetAsync(companyId, User.GetUserId(), memberId));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Altera o cargo do membro a partir de <c>effectiveFrom</c> (padrão hoje), preservando os dias anteriores (FR-012).</summary>
    /// <response code="422">Vigência no passado.</response>
    [HttpPut("{memberId:long}/position")]
    [ProducesResponseType(typeof(MemberInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ChangePosition(long companyId, long memberId, [FromBody] MemberPositionUpdateInfo info)
    {
        try
        {
            return Ok(await _memberService.ChangePositionAsync(companyId, User.GetUserId(), memberId, info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Define jornada e dias úteis próprios do membro, que prevalecem sobre os do cargo (FR-011).</summary>
    /// <response code="422">Vigência no passado.</response>
    [HttpPut("{memberId:long}/schedule")]
    [ProducesResponseType(typeof(ScheduleInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SetSchedule(long companyId, long memberId, [FromBody] ScheduleInput input)
    {
        try
        {
            return Ok(await _memberService.SetOwnScheduleAsync(companyId, User.GetUserId(), memberId, input));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Volta o membro à jornada do cargo a partir de <c>effectiveFrom</c> (padrão hoje).</summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="memberId">Membro.</param>
    /// <param name="effectiveFrom">Data local (<c>yyyy-MM-dd</c>), não passada.</param>
    /// <response code="422">Vigência no passado.</response>
    [HttpDelete("{memberId:long}/schedule")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ClearSchedule(long companyId, long memberId, [FromQuery] DateOnly? effectiveFrom)
    {
        try
        {
            await _memberService.ClearOwnScheduleAsync(companyId, User.GetUserId(), memberId, effectiveFrom);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Desativa o membro; remove a designação de gestor e os cargos supervisionados.</summary>
    /// <response code="422">O membro é o responsável pela empresa.</response>
    [HttpPost("{memberId:long}/deactivate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Deactivate(long companyId, long memberId)
    {
        try
        {
            await _memberService.DeactivateAsync(companyId, User.GetUserId(), memberId);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Reativa o membro (ativo a partir de hoje, com o último cargo).</summary>
    [HttpPost("{memberId:long}/reactivate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reactivate(long companyId, long memberId)
    {
        try
        {
            await _memberService.ReactivateAsync(companyId, User.GetUserId(), memberId);
            return NoContent();
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Designa o membro como gestor dos cargos informados ou remove a designação (<c>isManager=false</c> limpa os
    /// cargos) (FR-022c).
    /// </summary>
    /// <response code="404">Membro ou algum cargo inexistente na empresa.</response>
    /// <response code="422">Membro inativo ou responsável pela empresa.</response>
    [HttpPut("{memberId:long}/manager")]
    [ProducesResponseType(typeof(MemberInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SetManager(long companyId, long memberId, [FromBody] ManagerUpdateInfo info)
    {
        try
        {
            return Ok(await _memberService.SetManagerAsync(companyId, User.GetUserId(), memberId, info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
