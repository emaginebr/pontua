using FluentValidation;
using Pontua.DTO.Members;

namespace Pontua.Domain.Validators;

/// <summary><c>isManager</c> obrigatório; quando verdadeiro, ao menos um cargo, todos com id válido.</summary>
public class ManagerUpdateInfoValidator : AbstractValidator<ManagerUpdateInfo>
{
    public const int MAX_POSITIONS = 100;

    public ManagerUpdateInfoValidator()
    {
        RuleFor(x => x.IsManager)
            .NotNull().WithMessage("Informe se o membro é gestor.");

        RuleFor(x => x.PositionIds)
            .Must(ids => ids != null && ids.Count > 0)
            .WithMessage("Informe ao menos um cargo para o gestor.")
            .When(x => x.IsManager == true);

        RuleFor(x => x.PositionIds)
            .Must(ids => ids!.Count <= MAX_POSITIONS)
            .WithMessage($"Informe no máximo {MAX_POSITIONS} cargos.")
            .When(x => x.PositionIds != null);

        RuleForEach(x => x.PositionIds)
            .GreaterThan(0).WithMessage("Cargo inválido.")
            .When(x => x.IsManager == true);
    }
}
