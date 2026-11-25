using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;

namespace Pontua.Domain.Interfaces;

/// <summary>Cargos e jornadas versionadas dos cargos (FR-008 a FR-012, R-08).</summary>
public interface IPositionService
{
    /// <summary>Cargos da empresa com a jornada vigente hoje e o nº de membros ativos (membro ativo).</summary>
    Task<List<PositionInfo>> ListAsync(long companyId, long userId);

    /// <summary>Cargo com o histórico de jornadas (membro ativo); inexistente → 404.</summary>
    Task<PositionInfo> GetAsync(long companyId, long userId, long positionId);

    /// <summary>Cria o cargo com a jornada vigente a partir de hoje (responsável); nome repetido → 409.</summary>
    Task<PositionInfo> CreateAsync(long companyId, long userId, PositionInsertInfo info);

    /// <summary>Renomeia o cargo (responsável); nome repetido → 409.</summary>
    Task<PositionInfo> UpdateAsync(long companyId, long userId, long positionId, PositionUpdateInfo info);

    /// <summary>
    /// Grava nova versão da jornada (responsável). Vigência no passado → 422; na mesma data de uma versão
    /// existente (hoje ou futura) → substitui.
    /// </summary>
    Task<ScheduleInfo> SaveScheduleAsync(long companyId, long userId, long positionId, ScheduleInput input);

    /// <summary>Exclui cargo nunca usado (responsável); com membros ativos → 422; com histórico → 409.</summary>
    Task DeleteAsync(long companyId, long userId, long positionId);
}
