using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Pontua.Infra.Repository;

/// <summary>Tradução de erros do PostgreSQL para exceções independentes do provedor.</summary>
internal static class DbErrors
{
    /// <summary>
    /// <c>SaveChangesAsync</c> que converte violação de índice único (SQLSTATE 23505) em
    /// <see cref="UniqueConstraintViolationException"/>. A transação fica abortada no PostgreSQL: o chamador faz o
    /// rollback (que limpa o ChangeTracker).
    /// </summary>
    public static async Task SaveChangesOrUniqueViolationAsync(this PontuaContext context)
    {
        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg)
        {
            throw new UniqueConstraintViolationException(pg.ConstraintName, ex);
        }
    }
}
