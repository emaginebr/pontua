using FluentValidation;
using Pontua.DTO.Companies;

namespace Pontua.Domain.Validators;

public class CompanyInsertInfoValidator : AbstractValidator<CompanyInsertInfo>
{
    public CompanyInsertInfoValidator()
    {
        RuleFor(x => x.Name).CompanyName();
        RuleFor(x => x.Document).CompanyDocument();
        RuleFor(x => x.TimeZone).IanaTimeZone().When(x => !string.IsNullOrEmpty(x.TimeZone));
    }
}
