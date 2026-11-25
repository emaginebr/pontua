using FluentValidation;
using Pontua.DTO.Auth;

namespace Pontua.Domain.Validators;

public class RegisterInfoValidator : AbstractValidator<RegisterInfo>
{
    public RegisterInfoValidator()
    {
        RuleFor(x => x.Name).UserName();
        RuleFor(x => x.Email).UserEmail();
        RuleFor(x => x.Password).NewPassword();
    }
}
