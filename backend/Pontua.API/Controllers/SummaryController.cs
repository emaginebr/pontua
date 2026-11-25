using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Common;
using Pontua.DTO.Summary;

namespace Pontua.API.Controllers;

/// <summary>Resumo de horas trabalhadas × previstas (dias, semanas de segunda a domingo e total).</summary>
[ApiController]
[Route("api/companies/{companyId:long}")]
[Authorize]
[Produces("application/json")]
public class SummaryController : ControllerBase
{
    private readonly ISummaryService _summaryService;

    public SummaryController(ISummaryService summaryService)
    {
        _summaryService = summaryService;
    }

    /// <summary>Resumo de horas do chamador.</summary>
    /// <param name="companyId">Empresa.</param>
    /// <param name="query"><c>month</c> ou <c>start</c>/<c>end</c>; padrão mês corrente.</param>
    [HttpGet("summary/me")]
    [ProducesResponseType(typeof(HoursSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMine(long companyId, [FromQuery] DateRangeQuery query)
    {
        try
        {
            return Ok(await _summaryService.GetMySummaryAsync(companyId, User.GetUserId(), query));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Resumo de horas de um membro (o próprio, o responsável ou o gestor do cargo do membro).</summary>
    [HttpGet("members/{memberId:long}/summary")]
    [ProducesResponseType(typeof(HoursSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMember(long companyId, long memberId, [FromQuery] DateRangeQuery query)
    {
        try
        {
            return Ok(await _summaryService.GetSummaryAsync(companyId, User.GetUserId(), memberId, query));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
