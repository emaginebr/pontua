namespace Pontua.Infra.Interfaces.Repository;

public interface IPositionRepository<TModel> where TModel : class
{
    /// <summary>Cargo da empresa; nulo se não existir ou for de outra empresa.</summary>
    Task<TModel?> GetByIdAsync(long companyId, long positionId);

    Task<List<TModel>> ListByCompanyAsync(long companyId);
    Task<bool> ExistsNameAsync(long companyId, string name, long? exceptPositionId = null);

    /// <summary>Indica se o cargo tem histórico (membros, convites ou gestores) e não pode ser excluído (FR-008).</summary>
    Task<bool> HasHistoryAsync(long positionId);

    Task<TModel> InsertAsync(TModel position);
    Task<TModel> UpdateAsync(TModel position);

    /// <summary>Exclusão física — só para cargos nunca usados (FR-008).</summary>
    Task DeleteAsync(long positionId);
}
