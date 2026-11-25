using FluentValidation;
using Pontua.DTO.Auth;

namespace Pontua.Domain.Validators;

/// <summary>
/// Valida a nova senha. A exigência de <c>currentPassword</c> depende de a conta já ter senha e é verificada no
/// <c>AuthService</c>.
/// </summary>
public class PasswordUpdateInfoValidator : AbstractValidator<PasswordUpdateInfo>
{
    public PasswordUpdateInfoValidator()
    {
        RuleFor(x => x.NewPassword).NewPassword();
    }
}
