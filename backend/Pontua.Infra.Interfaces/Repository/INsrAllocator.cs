namespace Pontua.Infra.Interfaces.Repository;

/// <summary>
/// Aloca o próximo NSR da empresa (R-05). Exige transação aberta: o lock da linha da empresa serializa as
/// marcações e um rollback desfaz o incremento, sem lacunas.
/// </summary>
public interface INsrAllocator
{
    Task<long> NextAsync(long companyId);
}
