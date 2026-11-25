using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pontua.Application.Json;

/// <summary>Convenções JSON da API (contracts/api.md): camelCase, enums como string camelCase e horários <c>HH:mm</c>.</summary>
public static class PontuaJson
{
    public static JsonSerializerOptions ConfigurePontuaJson(this JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        options.Converters.Add(new TimeOnlyHourMinuteConverter());
        return options;
    }
}
