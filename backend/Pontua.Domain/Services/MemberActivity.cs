using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;

namespace Pontua.Domain.Services;

/// <summary>
/// Período de atividade do membro (data-model.md › members): ativo no dia D se <c>active_since ≤ D</c> e
/// (<c>deactivated_at</c> nulo ou a data local de <c>deactivated_at</c> &gt; D). Dias anteriores à última
/// (re)ativação não contam.
/// </summary>
public static class MemberActivity
{
    public static bool IsActiveOn(Member member, DateOnly date, string timeZoneId, ICompanyClock companyClock)
    {
        if (date < member.ActiveSince)
            return false;
        return member.DeactivatedAt == null || companyClock.LocalDate(member.DeactivatedAt.Value, timeZoneId) > date;
    }

    /// <summary>
    /// Regra do previsto (R-09, atualização): o dia conta se não for posterior a <paramref name="today"/> e o
    /// membro estava ativo nele.
    /// </summary>
    public static Func<DateOnly, bool> ExpectedCounts(Member member, DateOnly today, string timeZoneId, ICompanyClock companyClock)
    {
        // Data local da desativação calculada uma vez (o predicado roda por dia do intervalo).
        DateOnly? deactivatedOn = member.DeactivatedAt == null
            ? null
            : companyClock.LocalDate(member.DeactivatedAt.Value, timeZoneId);
        return date => date <= today && date >= member.ActiveSince && (deactivatedOn == null || deactivatedOn.Value > date);
    }
}
