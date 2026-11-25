using FluentValidation;

namespace Pontua.Domain.Validators;

/// <summary>Regras de conta compartilhadas pelos validadores de Auth (data-model.md › users).</summary>
public static class UserRules
{
    public const int NAME_MAX_LENGTH = 120;
    public const int EMAIL_MAX_LENGTH = 254;
    public const int PASSWORD_MIN_LENGTH = 8;

    /// <summary>Limite superior defensivo (evita hash de entradas enormes).</summary>
    public const int PASSWORD_MAX_LENGTH = 128;

    public static IRuleBuilderOptions<T, string> UserName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("O nome é obrigatório.")
            .MaximumLength(NAME_MAX_LENGTH).WithMessage($"O nome pode ter no máximo {NAME_MAX_LENGTH} caracteres.");

    public static IRuleBuilderOptions<T, string> UserEmail<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("O e-mail é obrigatório.")
            .MaximumLength(EMAIL_MAX_LENGTH).WithMessage($"O e-mail pode ter no máximo {EMAIL_MAX_LENGTH} caracteres.")
            .EmailAddress().WithMessage("E-mail inválido.");

    public static IRuleBuilderOptions<T, string> NewPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("A senha é obrigatória.")
            .MinimumLength(PASSWORD_MIN_LENGTH).WithMessage($"A senha deve ter no mínimo {PASSWORD_MIN_LENGTH} caracteres.")
            .MaximumLength(PASSWORD_MAX_LENGTH).WithMessage($"A senha pode ter no máximo {PASSWORD_MAX_LENGTH} caracteres.");
}
