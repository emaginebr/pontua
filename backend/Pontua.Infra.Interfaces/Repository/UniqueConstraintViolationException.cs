namespace Pontua.Infra.Interfaces.Repository;

/// <summary>
/// Violação de índice único detectada pelo banco (ex.: reenvio offline concorrente com o mesmo
/// <c>(member_id, client_id)</c>). Permite ao domínio tratar a corrida sem depender do provedor do banco.
/// </summary>
public class UniqueConstraintViolationException : Exception
{
    public UniqueConstraintViolationException(string? constraintName, Exception? innerException = null)
        : base($"Violação de índice único{(constraintName == null ? string.Empty : $" ({constraintName})")}.", innerException)
    {
        ConstraintName = constraintName;
    }

    /// <summary>Nome do índice violado, quando informado pelo banco.</summary>
    public string? ConstraintName { get; }
}
