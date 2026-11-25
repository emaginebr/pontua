using Pontua.Domain.Enums;
using Pontua.Domain.Models;

namespace Pontua.Domain.Services;

/// <summary>
/// Avalia um dia de um membro (R-07, R-09): associa as marcações aos períodos da jornada pela ordem de horário —
/// as que sobram são "extra" — e calcula trabalhado, previsto, saldo, <c>incomplete</c>, <c>missing</c> e
/// <c>hasPending</c>. O período não é gravado na marcação: é sempre calculado na leitura.
/// <para>
/// Regra (R-07, atualização — achados B-02/N-02): só as marcações que contam (<c>Valid</c>, <c>Approved</c>)
/// ocupam os períodos (<see cref="DayEvaluation.Periods"/>), associadas somente entre si. Inclusões pendentes
/// (<c>Pending</c> sem <c>ReplacesPunchId</c>) recebem um período hipotético — o que teriam se todas as pendências
/// do dia fossem aprovadas — sem deslocar as que contam. Correções pendentes não ocupam período e herdam o da
/// original. Aprovada a correção, a original vira <c>Superseded</c> (sai) e a correção <c>Approved</c> entra pela
/// ordem de horário.
/// </para>
/// </summary>
public static class DayEvaluator
{
    /// <param name="date">Dia local avaliado.</param>
    /// <param name="schedule">Jornada vigente no dia (nula se o membro não tinha jornada).</param>
    /// <param name="punches">Marcações do membro com <c>work_date</c> = <paramref name="date"/>, de qualquer status.</param>
    /// <param name="countsExpected">
    /// <c>false</c> para dias posteriores a hoje ou em que o membro não estava ativo: previsto 0 e nunca <c>missing</c>.
    /// </param>
    public static DayEvaluation Evaluate(DateOnly date, ResolvedSchedule? schedule, IEnumerable<Punch> punches, bool countsExpected = true)
    {
        var ordered = punches
            .OrderBy(p => p.PunchedAt)
            .ThenBy(p => p.Nsr)
            .ToList();

        var effective = ordered.Where(p => p.IsEffective).ToList();
        var periods = schedule?.Periods ?? Array.Empty<ResolvedPeriod>();
        var periodByPunch = new Dictionary<Punch, ResolvedPeriod>(ReferenceEqualityComparer.Instance);

        // 1) Marcações que contam (Valid/Approved) ocupam os períodos somente entre si, pela ordem de horário:
        //    k-ésima que conta ↔ k-ésimo período; excedentes são extra. Pendências nunca as deslocam.
        var counting = ordered.Where(p => p.CountsAsWorked).ToList();
        var slots = new List<PeriodSlot>(periods.Count);
        for (var i = 0; i < periods.Count; i++)
        {
            var punch = i < counting.Count ? counting[i] : null;
            if (punch != null)
                periodByPunch[punch] = periods[i];
            slots.Add(new PeriodSlot(periods[i], punch));
        }

        // 2) Inclusões pendentes recebem um período hipotético: o que ocupariam se todas as pendências do dia
        //    fossem aprovadas (ordenando juntas as que contam e as inclusões pendentes). Não altera as que contam.
        var hypothetical = ordered.Where(p => p.CountsAsWorked || IsPendingInclusion(p)).ToList();
        for (var i = 0; i < hypothetical.Count && i < periods.Count; i++)
        {
            if (IsPendingInclusion(hypothetical[i]))
                periodByPunch[hypothetical[i]] = periods[i];
        }

        // 3) Correção pendente não ocupa período: herda o da original que ela corrige (se estiver no dia).
        foreach (var correction in effective.Where(IsPendingCorrection))
        {
            var original = effective.FirstOrDefault(p =>
                !IsPendingCorrection(p) && p.PunchId != 0 && p.PunchId == correction.ReplacesPunchId);
            if (original != null && periodByPunch.TryGetValue(original, out var period))
                periodByPunch[correction] = period;
        }

        var evaluated = ordered
            .Select(p => new EvaluatedPunch(p, periodByPunch.TryGetValue(p, out var period) ? period : null))
            .ToList();

        var (worked, incomplete) = WorkHoursCalculator.CalculateWorked(ordered);
        var isWorkDay = schedule?.IsWorkDay ?? false;

        return new DayEvaluation
        {
            Date = date,
            Schedule = schedule,
            IsWorkDay = isWorkDay,
            CountsExpected = countsExpected,
            ExpectedMinutes = countsExpected ? WorkHoursCalculator.ExpectedMinutes(schedule) : 0,
            WorkedMinutes = worked,
            Incomplete = incomplete,
            Missing = isWorkDay && countsExpected && effective.Count == 0,
            HasPending = ordered.Any(p => p.Status == PunchStatus.Pending),
            Punches = evaluated,
            Periods = slots
        };
    }

    /// <summary>Inclusão ainda não analisada (manual sem <c>ReplacesPunchId</c>, offline ou fora do dia útil).</summary>
    private static bool IsPendingInclusion(Punch punch) =>
        punch.Status == PunchStatus.Pending && punch.ReplacesPunchId == null;

    /// <summary>Correção ainda não analisada: não ocupa período; herda o da original (R-07, atualização).</summary>
    private static bool IsPendingCorrection(Punch punch) =>
        punch.Status == PunchStatus.Pending && punch.ReplacesPunchId != null;

    /// <summary>Nome do período calculado para uma marcação (nulo = extra ou não efetiva).</summary>
    public static string? PeriodNameOf(DayEvaluation evaluation, Punch punch) =>
        evaluation.Punches.FirstOrDefault(e => ReferenceEquals(e.Punch, punch) || (punch.PunchId != 0 && e.Punch.PunchId == punch.PunchId))
            ?.Period?.Name;
}
