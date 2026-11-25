using System.Data;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Pontua.Infra.Repository;

public class UnitOfWork : IUnitOfWork
{
    private readonly PontuaContext _context;
    private IDbContextTransaction? _transaction;

    public UnitOfWork(PontuaContext context)
    {
        _context = context;
    }

    public bool HasActiveTransaction => _transaction != null;

    public async Task BeginTransactionAsync()
    {
        if (_transaction != null)
            throw new InvalidOperationException("Já existe uma transação aberta.");
        _transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
    }

    public async Task CommitAsync()
    {
        if (_transaction == null) return;
        await _transaction.CommitAsync();
        await _transaction.DisposeAsync();
        _transaction = null;
    }

    public async Task RollbackAsync()
    {
        if (_transaction == null) return;
        await _transaction.RollbackAsync();
        await _transaction.DisposeAsync();
        _transaction = null;
        _context.ChangeTracker.Clear();
    }
}
