using FluentValidation;
using Pontua.DTO.Auth;

namespace Pontua.Domain.Validators;

public class UserUpdateInfoValidator : AbstractValidator<UserUpdateInfo>
{
    public UserUpdateInfoValidator()
    {
        RuleFor(x => x.Name).UserName();
    }
}
