namespace Pontua.Infra.Interfaces.Repository;

public interface IInvitationRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long companyId, long invitationId);
    Task<TModel?> GetByTokenAsync(string token);

    /// <summary>Convites da empresa com <c>created_at</c> em [<paramref name="fromUtc"/>, <paramref name="toUtc"/>).</summary>
    Task<List<TModel>> ListByCompanyAsync(long companyId, DateTime fromUtc, DateTime toUtc);

    Task<TModel> InsertAsync(TModel invitation);
    Task<TModel> UpdateAsync(TModel invitation);

    /// <summary>
    /// Incrementa <c>accepted_count</c> de forma atômica no banco (<c>accepted_count = accepted_count + 1</c>), sem
    /// leitura-incremento-gravação: aceites concorrentes não perdem contagem. Participa da transação corrente.
    /// </summary>
    Task IncrementAcceptedCountAsync(long invitationId);
}
