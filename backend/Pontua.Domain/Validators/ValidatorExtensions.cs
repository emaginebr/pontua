using System.Text.Json;
using FluentValidation;
using Pontua.Domain.Exceptions;

namespace Pontua.Domain.Validators;

/// <summary>
/// Integra o FluentValidation com o envelope de erro (R-15): falhas viram a <see cref="Exceptions.ValidationException"/>
/// do domínio (400) com <c>{ campo, mensagem }</c> em camelCase.
/// </summary>
public static class ValidatorExtensions
{
    public const string DEFAULT_MESSAGE = "Dados inválidos.";

    public static async Task EnsureValidAsync<T>(this IValidator<T> validator, T instance)
    {
        var result = await validator.ValidateAsync(instance);
        if (result.IsValid)
            return;

        var errors = result.Errors
            .Select(e => new FieldError(ToCamelCasePath(e.PropertyName), e.ErrorMessage))
            .ToList();
        throw new Exceptions.ValidationException(errors.Count == 1 ? errors[0].Message : DEFAULT_MESSAGE, errors);
    }

    /// <summary><c>Days[0].Periods[1].ExpectedTime</c> → <c>days[0].periods[1].expectedTime</c>.</summary>
    public static string ToCamelCasePath(string propertyPath) =>
        string.Join('.', propertyPath.Split('.').Select(segment => JsonNamingPolicy.CamelCase.ConvertName(segment)));
}
