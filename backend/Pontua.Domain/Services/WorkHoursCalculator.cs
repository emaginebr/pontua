using Pontua.Domain.Models;

namespace Pontua.Domain.Services;

/// <summary>
/// Cálculo de horas e saldos (R-09, FR-027). Puro e determinístico; valores em minutos inteiros.
/// </summary>
public static class WorkHoursCalculator
{
    /// <summary>
    /// Minutos trabalhados no dia: marcações que contam (<c>Valid</c>, <c>Approved</c>) ordenadas pelo horário e
    /// pareadas (1ª–2ª, 3ª–4ª…). Cada instante é truncado ao minuto, coerente com o horário <c>HH:mm</c> exibido.
    /// Número ímpar → <c>Incomplete</c> e a última marcação sem par é ignorada.
    /// </summary>
    public static (int WorkedMinutes, bool Incomplete) CalculateWorked(IEnumerable<Punch> punches)
    {
        var instants = punches
            .Where(p => p.CountsAsWorked)
            .Select(p => TruncateToMinute(p.PunchedAt))
            .OrderBy(t => t)
            .ToList();

        var worked = 0;
        for (var i = 0; i + 1 < instants.Count; i += 2)
            worked += (int)(instants[i + 1] - instants[i]).TotalMinutes;

        return (worked, instants.Count % 2 == 1);
    }

    /// <summary>Carga prevista do dia: carga diária da jornada se for dia útil, senão 0.</summary>
    public static int ExpectedMinutes(ResolvedSchedule? schedule) =>
        schedule is { IsWorkDay: true } ? schedule.DailyMinutes : 0;

    /// <summary>Segunda-feira da semana da data.</summary>
    public static DateOnly WeekStart(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7; // segunda = 0 … domingo = 6
        return date.AddDays(-offset);
    }

    /// <summary>
    /// Semanas de segunda a domingo que cruzam o filtro [<paramref name="start"/>, <paramref name="end"/>].
    /// Semana inteira no filtro, toda no passado/hoje e com o membro ativo todos os dias (todos os dias com
    /// <see cref="DayEvaluation.CountsExpected"/>) → previsto = carga semanal da jornada vigente no primeiro dia útil
    /// da semana; caso contrário → soma das cargas diárias dos dias que contam (R-09, atualização).
    /// </summary>
    /// <param name="days">Avaliações dos dias do filtro (dias fora do filtro são ignorados).</param>
    public static IReadOnlyList<WeekSummary> SummarizeWeeks(IEnumerable<DayEvaluation> days, DateOnly start, DateOnly end)
    {
        if (end < start)
            throw new ArgumentException("A data final deve ser maior ou igual à inicial.", nameof(end));

        var byDate = days.Where(d => d.Date >= start && d.Date <= end).ToDictionary(d => d.Date);
        var weeks = new List<WeekSummary>();

        for (var weekStart = WeekStart(start); weekStart <= end; weekStart = weekStart.AddDays(7))
        {
            var weekEnd = weekStart.AddDays(6);
            var from = weekStart < start ? start : weekStart;
            var to = weekEnd > end ? end : weekEnd;
            var partial = from != weekStart || to != weekEnd;

            var weekDays = new List<DayEvaluation>();
            for (var day = from; day <= to; day = day.AddDays(1))
            {
                if (byDate.TryGetValue(day, out var evaluation))
                    weekDays.Add(evaluation);
            }

            int expected;
            if (partial || weekDays.Count < 7 || weekDays.Any(d => !d.CountsExpected))
            {
                // Dias que não contam já chegam com previsto 0.
                expected = weekDays.Sum(d => d.ExpectedMinutes);
            }
            else
            {
                var firstWorkDay = weekDays.OrderBy(d => d.Date).FirstOrDefault(d => d.IsWorkDay);
                expected = firstWorkDay?.Schedule?.WeeklyMinutes ?? 0;
            }

            weeks.Add(new WeekSummary
            {
                WeekStart = weekStart,
                From = from,
                To = to,
                Partial = partial,
                WorkedMinutes = weekDays.Sum(d => d.WorkedMinutes),
                ExpectedMinutes = expected
            });
        }

        return weeks;
    }

    private static DateTime TruncateToMinute(DateTime value) =>
        new(value.Ticks - value.Ticks % TimeSpan.TicksPerMinute, value.Kind);
}
