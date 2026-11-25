namespace Pontua.Infra.Interfaces.Repository;

/// <summary>Membros, histórico de cargo (<c>member_positions</c>) e cargos supervisionados (<c>manager_positions</c>).</summary>
public interface IMemberRepository<TMember, TMemberPosition, TManagerPosition>
    where TMember : class
    where TMemberPosition : class
    where TManagerPosition : class
{
    /// <summary>Membro da empresa (com o usuário carregado); nulo se não existir ou for de outra empresa.</summary>
    Task<TMember?> GetByIdAsync(long companyId, long memberId);

    Task<TMember?> GetByCompanyAndUserAsync(long companyId, long userId);

    /// <summary>Membros da empresa com o usuário carregado.</summary>
    Task<List<TMember>> ListByCompanyAsync(long companyId);

    /// <summary>Vínculos do usuário em todas as empresas.</summary>
    Task<List<TMember>> ListByUserAsync(long userId);

    Task<TMember> InsertAsync(TMember member);
    Task<TMember> UpdateAsync(TMember member);

    /// <summary>Histórico de cargos dos membros informados (todas as vigências), em lote.</summary>
    Task<List<TMemberPosition>> ListPositionHistoryAsync(IEnumerable<long> memberIds);

    /// <summary>Cargo do membro vigente na data (maior <c>effective_from ≤ date</c>); nulo se não houver.</summary>
    Task<long?> GetPositionIdOnAsync(long memberId, DateOnly date);

    /// <summary>Insere a vigência; se já existir uma na mesma data para o membro, substitui o cargo.</summary>
    Task<TMemberPosition> UpsertPositionAsync(TMemberPosition memberPosition);

    Task<List<long>> ListManagedPositionIdsAsync(long memberId);

    /// <summary>Substitui o conjunto de cargos supervisionados pelo gestor (lista vazia remove todos).</summary>
    Task ReplaceManagedPositionsAsync(long memberId, IEnumerable<TManagerPosition> managerPositions);
}
