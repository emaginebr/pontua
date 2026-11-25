namespace Pontua.Infra.Interfaces.Repository;

public interface IUserRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long userId);
    Task<List<TModel>> GetByIdsAsync(IEnumerable<long> userIds);

    /// <summary>Busca pelo e-mail já normalizado (minúsculas).</summary>
    Task<TModel?> GetByEmailAsync(string email);

    Task<TModel?> GetByGoogleSubjectAsync(string googleSubject);
    Task<bool> ExistsEmailAsync(string email, long? exceptUserId = null);
    Task<TModel> InsertAsync(TModel user);
    Task<TModel> UpdateAsync(TModel user);
}
