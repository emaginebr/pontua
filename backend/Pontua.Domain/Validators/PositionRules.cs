using FluentValidation;

namespace Pontua.Domain.Validators;

public static class PositionRules
{
    public const int NAME_MAX_LENGTH = 80;

    public static IRuleBuilderOptions<T, string> PositionName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("O nome do cargo é obrigatório.")
            .MaximumLength(NAME_MAX_LENGTH).WithMessage($"O nome do cargo pode ter no máximo {NAME_MAX_LENGTH} caracteres.");
}
