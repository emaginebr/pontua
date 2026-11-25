namespace Pontua.Domain.Exceptions;

/// <summary>Erro de um campo de entrada (vira <c>{ campo, mensagem }</c> no envelope de erro).</summary>
public sealed record FieldError(string Field, string Message);

/// <summary>Base das exceções de domínio mapeadas pelos controllers para 4xx (R-15).</summary>
public abstract class DomainException : Exception
{
    protected DomainException(string message, IEnumerable<FieldError>? errors = null) : base(message)
    {
        Errors = errors?.ToList() ?? new List<FieldError>();
    }

    public IReadOnlyList<FieldError> Errors { get; }
}

/// <summary>Entrada inválida → 400.</summary>
public class ValidationException : DomainException
{
    public ValidationException(string message, IEnumerable<FieldError>? errors = null) : base(message, errors) { }

    public ValidationException(string field, string message) : base(message, new[] { new FieldError(field, message) }) { }
}

/// <summary>Não autenticado ou credenciais inválidas → 401.</summary>
public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message = "Não autenticado.") : base(message) { }
}

/// <summary>Membro sem permissão para a operação → 403.</summary>
public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Você não tem permissão para esta operação.") : base(message) { }
}

/// <summary>Recurso inexistente ou empresa sem vínculo ativo → 404.</summary>
public class NotFoundException : DomainException
{
    public NotFoundException(string message) : base(message) { }
}

/// <summary>Conflito de estado → 409.</summary>
public class ConflictException : DomainException
{
    public ConflictException(string message) : base(message) { }
}

/// <summary>Regra de negócio violada → 422.</summary>
public class BusinessRuleException : DomainException
{
    public BusinessRuleException(string message) : base(message) { }
}
