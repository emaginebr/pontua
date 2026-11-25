using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

/// <summary>
/// NSR sequencial sem lacunas por empresa (R-05, FR-022b): <c>UPDATE … RETURNING</c> na transação corrente. O
/// lock da linha da empresa serializa as marcações e um rollback desfaz o incremento.
/// </summary>
public class NsrAllocator : INsrAllocator
{
    private readonly PontuaContext _context;

    public NsrAllocator(PontuaContext context)
    {
        _context = context;
    }

    public async Task<long> NextAsync(long companyId)
    {
        if (_context.Database.CurrentTransaction == null)
            throw new InvalidOperationException("O NSR só pode ser alocado dentro de uma transação (R-05).");

        // ToListAsync não compõe o SQL (um UPDATE não pode virar subconsulta).
        var values = await _context.Database
            .SqlQuery<long>($"UPDATE companies SET last_nsr = last_nsr + 1 WHERE company_id = {companyId} RETURNING last_nsr AS \"Value\"")
            .ToListAsync();

        if (values.Count == 0)
            throw new InvalidOperationException($"Empresa {companyId} não encontrada ao alocar o NSR.");
        return values[0];
    }
}
