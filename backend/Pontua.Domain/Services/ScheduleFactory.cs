using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Pontua.DTO.Schedules;

namespace Pontua.Domain.Services;

/// <summary>
/// Conversões da jornada (R-08): <see cref="ScheduleInput"/> → <see cref="Schedule"/> com dias e períodos, e
/// <see cref="Schedule"/> → <see cref="ScheduleInfo"/> sempre expandido por dia útil. Puro: a entrada já deve
/// ter passado pelo <c>ScheduleInputValidator</c>.
/// </summary>
public static class ScheduleFactory
{
    public const int DEFAULT_DAILY_MINUTES = 8 * 60;
    public const int DEFAULT_WEEKLY_MINUTES = 5 * DEFAULT_DAILY_MINUTES;

    /// <summary>
    /// Jornada semanal padrão do cargo inicial "Responsável" (R-16a): seg–sex, Entrada 08:00, Pausa 12:00,
    /// Retorno 13:00, Saída 17:00; 480 min/dia; 2400 min/semana.
    /// </summary>
    public static ScheduleInput DefaultWeekly() => new()
    {
        Mode = ScheduleInput.MODE_WEEKLY,
        WeeklyMinutes = DEFAULT_WEEKLY_MINUTES,
        DailyMinutes = DEFAULT_DAILY_MINUTES,
        WorkDays = new List<int>
        {
            (int)DayOfWeek.Monday, (int)DayOfWeek.Tuesday, (int)DayOfWeek.Wednesday,
            (int)DayOfWeek.Thursday, (int)DayOfWeek.Friday
        },
        Periods = new List<SchedulePeriodInput>
        {
            new() { Name = "Entrada", ExpectedTime = new TimeOnly(8, 0) },
            new() { Name = "Pausa", ExpectedTime = new TimeOnly(12, 0) },
            new() { Name = "Retorno", ExpectedTime = new TimeOnly(13, 0) },
            new() { Name = "Saída", ExpectedTime = new TimeOnly(17, 0) }
        }
    };

    /// <summary>
    /// Monta uma versão de jornada de cargo (<paramref name="positionId"/>) <b>ou</b> de membro
    /// (<paramref name="memberId"/>). No modo semanal os períodos ficam com <c>DayOfWeek</c> nulo.
    /// </summary>
    public static Schedule Create(
        ScheduleInput input,
        long companyId,
        long? positionId,
        long? memberId,
        DateOnly effectiveFrom,
        long createdByUserId,
        DateTime utcNow)
    {
        ArgumentNullException.ThrowIfNull(input);
        if ((positionId == null) == (memberId == null))
            throw new ArgumentException("A jornada pertence a um cargo ou a um membro (exatamente um).");

        var mode = ParseMode(input.Mode);
        var schedule = new Schedule
        {
            CompanyId = companyId,
            PositionId = positionId,
            MemberId = memberId,
            InheritsPosition = false,
            Mode = mode,
            WeeklyMinutes = input.WeeklyMinutes,
            EffectiveFrom = effectiveFrom,
            CreatedByUserId = createdByUserId,
            CreatedAt = utcNow
        };

        if (mode == ScheduleMode.Weekly)
        {
            var dailyMinutes = input.DailyMinutes
                ?? throw new ArgumentException("Modo semanal exige a carga diária.", nameof(input));
            foreach (var day in (input.WorkDays ?? new List<int>()).Distinct().Order())
                schedule.Days.Add(new ScheduleDay { DayOfWeek = (DayOfWeek)day, DailyMinutes = dailyMinutes });
            schedule.Periods.AddRange(BuildPeriods(input.Periods, dayOfWeek: null));
        }
        else
        {
            foreach (var day in (input.Days ?? new List<ScheduleDayInput>()).OrderBy(d => d.DayOfWeek))
            {
                var dayOfWeek = (DayOfWeek)day.DayOfWeek;
                schedule.Days.Add(new ScheduleDay { DayOfWeek = dayOfWeek, DailyMinutes = day.DailyMinutes });
                schedule.Periods.AddRange(BuildPeriods(day.Periods, dayOfWeek));
            }
        }

        return schedule;
    }

    /// <summary>
    /// Versão de jornada de membro que encerra a jornada própria e volta à do cargo (<c>inherits_position</c>, R-08).
    /// Modo e carga são ignorados pelo resolvedor; não há dias nem períodos.
    /// </summary>
    public static Schedule InheritPosition(long companyId, long memberId, DateOnly effectiveFrom, long createdByUserId, DateTime utcNow) => new()
    {
        CompanyId = companyId,
        PositionId = null,
        MemberId = memberId,
        InheritsPosition = true,
        Mode = ScheduleMode.Weekly,
        WeeklyMinutes = 0,
        EffectiveFrom = effectiveFrom,
        CreatedByUserId = createdByUserId,
        CreatedAt = utcNow
    };

    /// <summary>Versão de jornada expandida por dia útil (nos dois modos), dias em ordem de domingo a sábado.</summary>
    public static ScheduleInfo ToInfo(Schedule schedule)
    {
        ArgumentNullException.ThrowIfNull(schedule);
        return new ScheduleInfo
        {
            ScheduleId = schedule.ScheduleId,
            Mode = ToModeString(schedule.Mode),
            EffectiveFrom = schedule.EffectiveFrom,
            WeeklyMinutes = schedule.WeeklyMinutes,
            InheritsPosition = schedule.InheritsPosition ? true : null,
            Days = schedule.Days
                .OrderBy(d => d.DayOfWeek)
                .Select(day => new ScheduleDayInfo
                {
                    DayOfWeek = (int)day.DayOfWeek,
                    DailyMinutes = day.DailyMinutes,
                    Periods = schedule.Periods
                        .Where(p => schedule.Mode == ScheduleMode.Weekly ? p.DayOfWeek == null : p.DayOfWeek == day.DayOfWeek)
                        .OrderBy(p => p.Sequence)
                        .Select(p => new SchedulePeriodInfo { Sequence = p.Sequence, Name = p.Name, ExpectedTime = p.ExpectedTime })
                        .ToList()
                })
                .ToList()
        };
    }

    /// <summary>Versão vigente na data (maior <c>EffectiveFrom ≤ date</c>); nula se todas começarem depois.</summary>
    public static Schedule? CurrentOn(IEnumerable<Schedule> versions, DateOnly date) =>
        versions.Where(s => s.EffectiveFrom <= date).MaxBy(s => s.EffectiveFrom);

    public static ScheduleMode ParseMode(string? mode) =>
        mode?.Trim().ToLowerInvariant() switch
        {
            ScheduleInput.MODE_WEEKLY => ScheduleMode.Weekly,
            ScheduleInput.MODE_DAILY => ScheduleMode.Daily,
            _ => throw new ArgumentException($"Modo de jornada inválido: '{mode}'.", nameof(mode))
        };

    public static string ToModeString(ScheduleMode mode) => mode switch
    {
        ScheduleMode.Weekly => ScheduleInput.MODE_WEEKLY,
        ScheduleMode.Daily => ScheduleInput.MODE_DAILY,
        _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, null)
    };

    private static IEnumerable<SchedulePeriod> BuildPeriods(IEnumerable<SchedulePeriodInput>? periods, DayOfWeek? dayOfWeek) =>
        (periods ?? Enumerable.Empty<SchedulePeriodInput>())
            .Select((period, index) => new SchedulePeriod
            {
                DayOfWeek = dayOfWeek,
                Sequence = index + 1,
                Name = period.Name.Trim(),
                ExpectedTime = period.ExpectedTime
            });
}
