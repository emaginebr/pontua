using System.Text.Json;

namespace Pontua.Domain.Services;

/// <summary>Enums do domínio como string camelCase nos DTOs (contracts/api.md: <c>"outsideWorkday"</c>, <c>"pending"</c>…).</summary>
public static class ApiText
{
    public static string Of<TEnum>(TEnum value) where TEnum : struct, Enum =>
        JsonNamingPolicy.CamelCase.ConvertName(value.ToString());

    public static string? Of<TEnum>(TEnum? value) where TEnum : struct, Enum =>
        value.HasValue ? Of(value.Value) : null;
}
