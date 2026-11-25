using FluentValidation;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Validators;

/// <summary>
/// Marcação manual (FR-018): data e hora obrigatórias, justificativa de 5 a 500 caracteres (sem contar espaços nas
/// pontas). Futuro e limite retroativo dependem do fuso e da configuração da empresa e ficam no serviço (422).
/// </summary>
public class ManualPunchInsertInfoValidator : AbstractValidator<ManualPunchInsertInfo>
{
    public const string JUSTIFICATION_REQUIRED_MESSAGE = "A justificativa é obrigatória.";

    public ManualPunchInsertInfoValidator()
    {
        RuleFor(x => x.WorkDate)
            .NotNull().WithMessage("A data da marcação é obrigatória.");

        RuleFor(x => x.Time)
            .NotNull().WithMessage("O horário da marcação é obrigatório.");

        RuleFor(x => x.Justification)
            .Must(j => !string.IsNullOrWhiteSpace(j)).WithMessage(JUSTIFICATION_REQUIRED_MESSAGE)
            .DependentRules(() =>
            {
                RuleFor(x => x.Justification!.Trim().Length)
                    .InclusiveBetween(ManualPunchInsertInfo.JUSTIFICATION_MIN_LENGTH, ManualPunchInsertInfo.JUSTIFICATION_MAX_LENGTH)
                    .OverridePropertyName("justification")
                    .WithMessage($"A justificativa deve ter de {ManualPunchInsertInfo.JUSTIFICATION_MIN_LENGTH} a " +
                                 $"{ManualPunchInsertInfo.JUSTIFICATION_MAX_LENGTH} caracteres.");
            });

        RuleFor(x => x.ReplacesPunchId)
            .GreaterThan(0).WithMessage("A marcação a corrigir é inválida.")
            .When(x => x.ReplacesPunchId.HasValue);
    }
}
