namespace Pontua.Infra.Interfaces.Repository;

/// <summary>Versões de jornada (R-08), sempre carregadas com dias e períodos.</summary>
public interface IScheduleRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long scheduleId);

    /// <summary>Todas as versões dos cargos informados, em lote.</summary>
    Task<List<TModel>> ListByPositionsAsync(IEnumerable<long> positionIds);

    /// <summary>Todas as versões próprias dos membros informados, em lote.</summary>
    Task<List<TModel>> ListByMembersAsync(IEnumerable<long> memberIds);

    Task<TModel?> GetByPositionAndDateAsync(long positionId, DateOnly effectiveFrom);
    Task<TModel?> GetByMemberAndDateAsync(long memberId, DateOnly effectiveFrom);

    Task<TModel> InsertAsync(TModel schedule);

    /// <summary>Remove uma versão ainda não vigente (substituição na mesma data, R-08).</summary>
    Task DeleteAsync(long scheduleId);
}
