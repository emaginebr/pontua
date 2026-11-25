using Pontua.Domain.Exceptions;
using Pontua.DTO;
using Microsoft.AspNetCore.Mvc;

namespace Pontua.API.Extensions;

/// <summary>
/// Mapeamento padrão das exceções de domínio para o envelope <c>{ sucesso, mensagem, erros }</c> (R-15).
/// Uso em todo controller (Princípio VII):
/// <code>
/// try { ... }
/// catch (DomainException ex) { return this.DomainError(ex); }
/// catch (Exception ex) { return StatusCode(500, ex.Message); }
/// </code>
/// </summary>
public static class ControllerErrorExtensions
{
    public static ObjectResult DomainError(this ControllerBase controller, DomainException exception)
    {
        var status = StatusCodeFor(exception);
        return controller.StatusCode(status, ToErrorResult(exception));
    }

    public static int StatusCodeFor(DomainException exception) => exception switch
    {
        ValidationException => StatusCodes.Status400BadRequest,
        UnauthorizedException => StatusCodes.Status401Unauthorized,
        ForbiddenException => StatusCodes.Status403Forbidden,
        NotFoundException => StatusCodes.Status404NotFound,
        ConflictException => StatusCodes.Status409Conflict,
        BusinessRuleException => StatusCodes.Status422UnprocessableEntity,
        _ => StatusCodes.Status400BadRequest
    };

    public static ErrorResult ToErrorResult(DomainException exception) => new()
    {
        Sucesso = false,
        Mensagem = exception.Message,
        Erros = exception.Errors
            .Select(e => new ErrorItem { Campo = e.Field, Mensagem = e.Message })
            .ToList()
    };
}
