using FluentValidation;
using Pontua.DTO.Auth;

namespace Pontua.Domain.Validators;

/// <summary>Só presença dos campos: credenciais erradas viram 401 genérico no serviço, não 400.</summary>
public class LoginInfoValidator : AbstractValidator<LoginInfo>
{
    public LoginInfoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("O e-mail é obrigatório.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("A senha é obrigatória.");
    }
}
