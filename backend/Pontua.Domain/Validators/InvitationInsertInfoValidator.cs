using FluentValidation;
using Pontua.DTO.Invitations;

namespace Pontua.Domain.Validators;

public class InvitationInsertInfoValidator : AbstractValidator<InvitationInsertInfo>
{
    public InvitationInsertInfoValidator()
    {
        RuleFor(x => x.PositionId)
            .NotNull().WithMessage("O cargo do convite é obrigatório.")
            .GreaterThan(0).WithMessage("O cargo do convite é obrigatório.");

        RuleFor(x => x.ExpiresInDays)
            .InclusiveBetween(InvitationInsertInfo.MIN_EXPIRES_IN_DAYS, InvitationInsertInfo.MAX_EXPIRES_IN_DAYS)
            .WithMessage($"A validade do convite deve ser de {InvitationInsertInfo.MIN_EXPIRES_IN_DAYS} a " +
                         $"{InvitationInsertInfo.MAX_EXPIRES_IN_DAYS} dias.")
            .When(x => x.ExpiresInDays.HasValue);
    }
}
