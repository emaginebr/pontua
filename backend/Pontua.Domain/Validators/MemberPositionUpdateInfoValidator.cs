using FluentValidation;
using Pontua.DTO.Members;

namespace Pontua.Domain.Validators;

/// <summary>Cargo obrigatório. A vigência passada depende do fuso da empresa e é recusada no serviço (422).</summary>
public class MemberPositionUpdateInfoValidator : AbstractValidator<MemberPositionUpdateInfo>
{
    public MemberPositionUpdateInfoValidator()
    {
        RuleFor(x => x.PositionId)
            .NotNull().WithMessage("O cargo é obrigatório.")
            .GreaterThan(0).WithMessage("O cargo é obrigatório.");
    }
}
