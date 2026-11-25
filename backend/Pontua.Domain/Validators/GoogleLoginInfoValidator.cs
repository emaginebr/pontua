using FluentValidation;
using Pontua.DTO.Auth;

namespace Pontua.Domain.Validators;

public class GoogleLoginInfoValidator : AbstractValidator<GoogleLoginInfo>
{
    public GoogleLoginInfoValidator()
    {
        RuleFor(x => x.IdToken).NotEmpty().WithMessage("O token do Google é obrigatório.");
    }
}
