using FluentValidation;
using Pontua.DTO.Companies;

namespace Pontua.Domain.Validators;

public class TransferOwnershipInfoValidator : AbstractValidator<TransferOwnershipInfo>
{
    public TransferOwnershipInfoValidator()
    {
        RuleFor(x => x.MemberId)
            .NotNull().WithMessage("Informe o membro que será o novo responsável.")
            .GreaterThan(0).WithMessage("Informe o membro que será o novo responsável.");
    }
}
