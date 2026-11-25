using FluentValidation;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Validators;

/// <summary>Observação da análise: opcional, até 500 caracteres (sem contar espaços nas pontas).</summary>
public class ReviewInsertInfoValidator : AbstractValidator<ReviewInsertInfo>
{
    public ReviewInsertInfoValidator()
    {
        RuleFor(x => x.Note!.Trim().Length)
            .LessThanOrEqualTo(ReviewInsertInfo.NOTE_MAX_LENGTH)
            .OverridePropertyName("note")
            .WithMessage($"A observação pode ter no máximo {ReviewInsertInfo.NOTE_MAX_LENGTH} caracteres.")
            .When(x => x.Note != null);
    }
}
