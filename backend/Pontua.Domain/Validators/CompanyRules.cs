using FluentValidation;
using Pontua.Domain.Services;

namespace Pontua.Domain.Validators;

/// <summary>Regras de empresa compartilhadas (data-model.md › companies).</summary>
public static class CompanyRules
{
    public const int NAME_MAX_LENGTH = 160;
    public const int DOCUMENT_MAX_LENGTH = 20;
    public const int MIN_MANUAL_RETRO_DAYS = 1;
    public const int MAX_MANUAL_RETRO_DAYS = 365;
    public const string INVALID_TIME_ZONE_MESSAGE = "Fuso horário inválido. Use um ID IANA, ex.: America/Sao_Paulo.";

    public static IRuleBuilderOptions<T, string> CompanyName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("O nome da empresa é obrigatório.")
            .MaximumLength(NAME_MAX_LENGTH).WithMessage($"O nome da empresa pode ter no máximo {NAME_MAX_LENGTH} caracteres.");

    /// <summary>Documento opcional: só dígitos, até 20.</summary>
    public static IRuleBuilderOptions<T, string?> CompanyDocument<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(document => string.IsNullOrEmpty(document)
                || (document.Length <= DOCUMENT_MAX_LENGTH && document.All(char.IsAsciiDigit)))
            .WithMessage($"O documento deve conter só dígitos (até {DOCUMENT_MAX_LENGTH}).");

    public static IRuleBuilderOptions<T, string?> IanaTimeZone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(CompanyClock.IsValidTimeZone)
            .WithMessage(INVALID_TIME_ZONE_MESSAGE);
}
