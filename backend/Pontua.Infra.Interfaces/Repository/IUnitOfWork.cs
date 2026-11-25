namespace Pontua.Infra.Interfaces.Repository;

/// <summary>Transação de banco compartilhada pelos repositórios da requisição.</summary>
public interface IUnitOfWork
{
    bool HasActiveTransaction { get; }
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
}
