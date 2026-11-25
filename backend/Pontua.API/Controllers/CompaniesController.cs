using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pontua.API.Extensions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.DTO;
using Pontua.DTO.Companies;

namespace Pontua.API.Controllers;

/// <summary>Empresas do usuário autenticado.</summary>
[ApiController]
[Route("api/companies")]
[Authorize]
[Produces("application/json")]
public class CompaniesController : ControllerBase
{
    private readonly ICompanyService _companyService;

    public CompaniesController(ICompanyService companyService)
    {
        _companyService = companyService;
    }

    /// <summary>Empresas em que o usuário é membro ativo.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<CompanySummary>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> List()
    {
        try
        {
            return Ok(await _companyService.ListAsync(User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Cria a empresa; o criador vira responsável e membro, com o cargo inicial "Responsável" e jornada semanal
    /// padrão (seg–sex, 08:00/12:00/13:00/17:00).
    /// </summary>
    /// <response code="201">Empresa criada.</response>
    /// <response code="400">Dados inválidos.</response>
    [HttpPost]
    [ProducesResponseType(typeof(CompanyInfo), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Create([FromBody] CompanyInsertInfo info)
    {
        try
        {
            var company = await _companyService.CreateAsync(User.GetUserId(), info);
            return CreatedAtAction(nameof(Get), new { companyId = company.CompanyId }, company);
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Dados da empresa (membro ativo).</summary>
    /// <response code="404">Empresa inexistente ou sem vínculo ativo.</response>
    [HttpGet("{companyId:long}")]
    [ProducesResponseType(typeof(CompanyInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(long companyId)
    {
        try
        {
            return Ok(await _companyService.GetAsync(companyId, User.GetUserId()));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>Atualiza os dados da empresa (só o responsável).</summary>
    /// <response code="403">Não é o responsável.</response>
    /// <response code="404">Empresa inexistente ou sem vínculo ativo.</response>
    [HttpPut("{companyId:long}")]
    [ProducesResponseType(typeof(CompanyInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(long companyId, [FromBody] CompanyUpdateInfo info)
    {
        try
        {
            return Ok(await _companyService.UpdateAsync(companyId, User.GetUserId(), info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }

    /// <summary>
    /// Transfere a responsabilidade para outro membro ativo (FR-006). Se o alvo era gestor, perde a designação; o
    /// antigo responsável continua membro comum.
    /// </summary>
    /// <response code="200">Empresa com o novo responsável; <c>myAccess</c> já reflete o acesso do chamador.</response>
    /// <response code="400">Membro não informado.</response>
    /// <response code="403">Não é o responsável.</response>
    /// <response code="404">Empresa sem vínculo ativo ou membro inexistente.</response>
    /// <response code="422">O membro alvo está desativado.</response>
    [HttpPost("{companyId:long}/transfer-ownership")]
    [ProducesResponseType(typeof(CompanyInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResult), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> TransferOwnership(long companyId, [FromBody] TransferOwnershipInfo info)
    {
        try
        {
            return Ok(await _companyService.TransferOwnershipAsync(companyId, User.GetUserId(), info));
        }
        catch (DomainException ex) { return this.DomainError(ex); }
        catch (Exception ex) { return StatusCode(500, ex.Message); }
    }
}
