using Pontua.Domain.Models;

namespace Pontua.Domain.Interfaces;

/// <summary>
/// Resolve a jornada vigente de membros por data (R-08). Puro: recebe as versões já carregadas em lote
/// (<c>member_positions</c> e <c>schedules</c> de cargos e membros), sem acesso a banco.
/// </summary>
public interface IScheduleResolver
{
    /// <summary>Jornada do membro na data; nulo se ele não tem jornada própria nem cargo com jornada vigente.</summary>
    ResolvedSchedule? Resolve(
        long memberId,
        DateOnly date,
        IEnumerable<MemberPosition> memberPositions,
        IEnumerable<Schedule> schedules);

    /// <summary>
    /// Jornadas de vários membros em cada dia do intervalo (inclusivo), indexando as versões uma única vez.
    /// Resultado: membro → data → jornada (nula quando não houver).
    /// </summary>
    IReadOnlyDictionary<long, IReadOnlyDictionary<DateOnly, ResolvedSchedule?>> ResolveRange(
        IEnumerable<long> memberIds,
        DateOnly start,
        DateOnly end,
        IEnumerable<MemberPosition> memberPositions,
        IEnumerable<Schedule> schedules);
}
