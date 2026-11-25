using FluentValidation;
using Pontua.DTO.Positions;

namespace Pontua.Domain.Validators;

public class PositionInsertInfoValidator : AbstractValidator<PositionInsertInfo>
{
    public PositionInsertInfoValidator()
    {
        RuleFor(x => x.Name).PositionName();
        RuleFor(x => x.Schedule)
            .NotNull().WithMessage("A jornada do cargo é obrigatória.");
        RuleFor(x => x.Schedule!)
            .SetValidator(new ScheduleInputValidator())
            .When(x => x.Schedule != null);
    }
}
