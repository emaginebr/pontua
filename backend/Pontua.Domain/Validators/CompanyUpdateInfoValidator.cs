using FluentValidation;
using Pontua.Domain.Services;
using Pontua.DTO.Companies;

namespace Pontua.Domain.Validators;

public class CompanyUpdateInfoValidator : AbstractValidator<CompanyUpdateInfo>
{
    public CompanyUpdateInfoValidator()
    {
        RuleFor(x => x.Name).CompanyName();
        RuleFor(x => x.Document).CompanyDocument();
        RuleFor(x => x.TimeZone)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("O fuso horário é obrigatório.")
            .Must(CompanyClock.IsValidTimeZone).WithMessage(CompanyRules.INVALID_TIME_ZONE_MESSAGE);
        RuleFor(x => x.ManualRetroDays)
            .InclusiveBetween(CompanyRules.MIN_MANUAL_RETRO_DAYS, CompanyRules.MAX_MANUAL_RETRO_DAYS)
            .WithMessage($"O limite retroativo deve ficar entre {CompanyRules.MIN_MANUAL_RETRO_DAYS} e {CompanyRules.MAX_MANUAL_RETRO_DAYS} dias.");
    }
}
