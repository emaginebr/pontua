using FluentValidation;
using Pontua.DTO.Positions;

namespace Pontua.Domain.Validators;

public class PositionUpdateInfoValidator : AbstractValidator<PositionUpdateInfo>
{
    public PositionUpdateInfoValidator()
    {
        RuleFor(x => x.Name).PositionName();
    }
}
