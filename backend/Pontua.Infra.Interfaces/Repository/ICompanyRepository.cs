namespace Pontua.Infra.Interfaces.Repository;

public interface ICompanyRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long companyId);
    Task<List<TModel>> GetByIdsAsync(IEnumerable<long> companyIds);
    Task<TModel> InsertAsync(TModel company);

    /// <summary>
    /// Atualiza os dados cadastrais. Não altera <c>last_nsr</c>, que só muda pelo <see cref="INsrAllocator"/>.
    /// </summary>
    Task<TModel> UpdateAsync(TModel company);
}
