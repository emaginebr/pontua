using Pontua.DTO.Members;
using Pontua.DTO.Schedules;

namespace Pontua.Domain.Interfaces;

/// <summary>Membros da empresa (FR-015, FR-022d).</summary>
public interface IMemberService
{
    /// <summary>
    /// Membros por nome (responsável: todos; gestor: só os dos seus cargos vigentes hoje; demais → 403).
    /// <paramref name="status"/>: <c>active</c> (padrão), <c>inactive</c> ou <c>all</c>; <paramref name="positionId"/>
    /// filtra pelo cargo vigente hoje.
    /// </summary>
    Task<List<MemberInfo>> ListAsync(long companyId, long userId, string? status, long? positionId);

    /// <summary>O membro chamador, com cargo e jornada vigentes hoje.</summary>
    Task<MemberInfo> GetMeAsync(long companyId, long userId);

    /// <summary>Detalhe com <c>positionHistory</c> e <c>scheduleHistory</c> (o próprio, o responsável ou o gestor do cargo).</summary>
    Task<MemberInfo> GetAsync(long companyId, long userId, long memberId);

    /// <summary>Novo cargo a partir de <c>effectiveFrom</c> (padrão hoje; passada → 422). Só o responsável.</summary>
    Task<MemberInfo> ChangePositionAsync(long companyId, long userId, long memberId, MemberPositionUpdateInfo info);

    /// <summary>Nova versão de jornada própria do membro (FR-011; vigência passada → 422). Só o responsável.</summary>
    Task<ScheduleInfo> SetOwnScheduleAsync(long companyId, long userId, long memberId, ScheduleInput input);

    /// <summary>
    /// Volta à jornada do cargo a partir de <paramref name="effectiveFrom"/> (padrão hoje; passada → 422): descarta
    /// versões próprias dessa data em diante e grava uma versão <c>inherits_position</c>. Só o responsável.
    /// </summary>
    Task ClearOwnScheduleAsync(long companyId, long userId, long memberId, DateOnly? effectiveFrom);

    /// <summary>Desativa (o responsável → 422); limpa a designação de gestor e os cargos supervisionados.</summary>
    Task DeactivateAsync(long companyId, long userId, long memberId);

    /// <summary>Reativa com <c>active_since</c> = hoje, mantendo o último cargo. Só o responsável.</summary>
    Task ReactivateAsync(long companyId, long userId, long memberId);

    /// <summary>
    /// Designa/remove gestor (FR-022c): cargos da empresa (senão 404); alvo ativo e diferente do responsável (422);
    /// <c>isManager=false</c> limpa os cargos. Só o responsável.
    /// </summary>
    Task<MemberInfo> SetManagerAsync(long companyId, long userId, long memberId, ManagerUpdateInfo info);
}
