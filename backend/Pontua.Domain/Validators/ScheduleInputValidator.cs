using FluentValidation;
using Pontua.DTO.Schedules;

namespace Pontua.Domain.Validators;

/// <summary>
/// Estrutura da jornada (FR-009/010, data-model.md › schedules). A regra "<c>effectiveFrom</c> não pode ser
/// passado" depende do fuso da empresa e é aplicada pelo serviço (422).
/// </summary>
public class ScheduleInputValidator : AbstractValidator<ScheduleInput>
{
    public const int MIN_WEEKLY_MINUTES = 1;
    public const int MAX_WEEKLY_MINUTES = 7 * 24 * 60;
    public const int MIN_DAILY_MINUTES = 1;
    public const int MAX_DAILY_MINUTES = 24 * 60;
    public const int MIN_PERIODS = 1;
    public const int MAX_PERIODS = 12;
    public const int PERIOD_NAME_MAX_LENGTH = 40;

    public ScheduleInputValidator()
    {
        RuleFor(x => x.Mode)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("O modo da jornada é obrigatório.")
            .Must(mode => IsWeekly(mode) || IsDaily(mode)).WithMessage("Modo de jornada inválido: use 'weekly' ou 'daily'.");

        RuleFor(x => x.WeeklyMinutes)
            .InclusiveBetween(MIN_WEEKLY_MINUTES, MAX_WEEKLY_MINUTES)
            .WithMessage($"A carga semanal deve ficar entre {MIN_WEEKLY_MINUTES} e {MAX_WEEKLY_MINUTES} minutos.");

        When(x => IsWeekly(x.Mode), () =>
        {
            RuleFor(x => x.WorkDays)
                .NotEmpty().WithMessage("Informe ao menos um dia útil.");
            RuleForEach(x => x.WorkDays)
                .Must(IsDayOfWeek).WithMessage("Dia da semana inválido (0 = domingo … 6 = sábado).");
            RuleFor(x => x.WorkDays)
                .Must(days => days!.Distinct().Count() == days!.Count).WithMessage("Há dias úteis repetidos.")
                .When(x => x.WorkDays != null);

            RuleFor(x => x.DailyMinutes)
                .NotNull().WithMessage("A carga diária é obrigatória no modo semanal.")
                .InclusiveBetween(MIN_DAILY_MINUTES, MAX_DAILY_MINUTES)
                .WithMessage($"A carga diária deve ficar entre {MIN_DAILY_MINUTES} e {MAX_DAILY_MINUTES} minutos.");

            RuleFor(x => x.Periods)
                .NotNull().WithMessage("Informe os períodos da jornada.")
                .DependentRules(() => RuleFor(x => x.Periods!).PeriodList());
            RuleForEach(x => x.Periods)
                .NotNull().WithMessage("Período inválido.")
                .SetValidator(new SchedulePeriodInputValidator());
        });

        When(x => IsDaily(x.Mode), () =>
        {
            RuleFor(x => x.Days)
                .NotEmpty().WithMessage("Informe ao menos um dia útil.");
            RuleFor(x => x.Days)
                .Must(days => days!.Where(d => d != null).Select(d => d.DayOfWeek).Distinct().Count()
                    == days!.Count(d => d != null))
                .WithMessage("Há dias da semana repetidos.")
                .When(x => x.Days != null);
            RuleForEach(x => x.Days)
                .NotNull().WithMessage("Dia inválido.")
                .SetValidator(new ScheduleDayInputValidator());
        });
    }

    public static bool IsWeekly(string? mode) =>
        string.Equals(mode, ScheduleInput.MODE_WEEKLY, StringComparison.OrdinalIgnoreCase);

    public static bool IsDaily(string? mode) =>
        string.Equals(mode, ScheduleInput.MODE_DAILY, StringComparison.OrdinalIgnoreCase);

    public static bool IsDayOfWeek(int day) => day is >= 0 and <= 6;

    /// <summary>Horários previstos informados devem ser estritamente crescentes (os nulos são ignorados).</summary>
    public static bool HasIncreasingTimes(IEnumerable<SchedulePeriodInput> periods)
    {
        TimeOnly? last = null;
        foreach (var time in periods.Where(p => p?.ExpectedTime != null).Select(p => p.ExpectedTime!.Value))
        {
            if (last != null && time <= last.Value)
                return false;
            last = time;
        }
        return true;
    }
}

/// <summary>Dia útil do modo diário.</summary>
public class ScheduleDayInputValidator : AbstractValidator<ScheduleDayInput>
{
    public ScheduleDayInputValidator()
    {
        RuleFor(x => x.DayOfWeek)
            .Must(ScheduleInputValidator.IsDayOfWeek).WithMessage("Dia da semana inválido (0 = domingo … 6 = sábado).");
        RuleFor(x => x.DailyMinutes)
            .InclusiveBetween(ScheduleInputValidator.MIN_DAILY_MINUTES, ScheduleInputValidator.MAX_DAILY_MINUTES)
            .WithMessage($"A carga diária deve ficar entre {ScheduleInputValidator.MIN_DAILY_MINUTES} e {ScheduleInputValidator.MAX_DAILY_MINUTES} minutos.");
        RuleFor(x => x.Periods)
            .NotNull().WithMessage("Informe os períodos do dia.")
            .DependentRules(() => RuleFor(x => x.Periods).PeriodList());
        RuleForEach(x => x.Periods)
            .NotNull().WithMessage("Período inválido.")
            .SetValidator(new SchedulePeriodInputValidator());
    }
}

public class SchedulePeriodInputValidator : AbstractValidator<SchedulePeriodInput>
{
    public SchedulePeriodInputValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("O nome do período é obrigatório.")
            .MaximumLength(ScheduleInputValidator.PERIOD_NAME_MAX_LENGTH)
            .WithMessage($"O nome do período pode ter no máximo {ScheduleInputValidator.PERIOD_NAME_MAX_LENGTH} caracteres.");
    }
}

internal static class SchedulePeriodListRules
{
    /// <summary>1 a 12 períodos por dia, com horários previstos crescentes.</summary>
    public static IRuleBuilderOptions<T, List<SchedulePeriodInput>> PeriodList<T>(this IRuleBuilder<T, List<SchedulePeriodInput>> rule) =>
        rule.Must(periods => periods.Count is >= ScheduleInputValidator.MIN_PERIODS and <= ScheduleInputValidator.MAX_PERIODS)
                .WithMessage($"Cada dia deve ter de {ScheduleInputValidator.MIN_PERIODS} a {ScheduleInputValidator.MAX_PERIODS} períodos.")
            .Must(ScheduleInputValidator.HasIncreasingTimes)
                .WithMessage("Os horários previstos dos períodos devem ser crescentes.");
}
