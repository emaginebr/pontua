using FluentAssertions;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Services;
using Pontua.DTO.Common;

namespace Pontua.Tests.Domain;

public class DateRangeResolverTests
{
    private static readonly DateOnly TODAY = new(2026, 11, 25);

    [Fact]
    public void Resolve_ShouldReturnCurrentMonth_WhenNoParameterIsGiven()
    {
        var range = DateRangeResolver.Resolve(new DateRangeQuery(), TODAY);

        range.Start.Should().Be(new DateOnly(2026, 11, 1));
        range.End.Should().Be(new DateOnly(2026, 11, 30));
    }

    [Fact]
    public void Resolve_ShouldReturnCurrentMonth_WhenQueryIsNull()
    {
        var range = DateRangeResolver.Resolve(null, new DateOnly(2028, 2, 10));

        range.Start.Should().Be(new DateOnly(2028, 2, 1));
        range.End.Should().Be(new DateOnly(2028, 2, 29));
    }

    [Theory]
    [InlineData("2026-02", 2026, 2, 28)]
    [InlineData("2026-12", 2026, 12, 31)]
    [InlineData(" 2024-02 ", 2024, 2, 29)]
    public void Resolve_ShouldReturnWholeMonth_WhenMonthIsGiven(string month, int year, int monthNumber, int lastDay)
    {
        var range = DateRangeResolver.Resolve(new DateRangeQuery { Month = month }, TODAY);

        range.Start.Should().Be(new DateOnly(year, monthNumber, 1));
        range.End.Should().Be(new DateOnly(year, monthNumber, lastDay));
    }

    [Fact]
    public void Resolve_ShouldReturnInclusiveInterval_WhenStartAndEndAreGiven()
    {
        var range = DateRangeResolver.Resolve(new DateRangeQuery { Start = "2026-11-01", End = "2026-11-15" }, TODAY);

        range.Start.Should().Be(new DateOnly(2026, 11, 1));
        range.End.Should().Be(new DateOnly(2026, 11, 15));
        range.TotalDays.Should().Be(15);
    }

    [Fact]
    public void Resolve_ShouldAcceptSingleDay_WhenStartEqualsEnd()
    {
        var range = DateRangeResolver.Resolve(new DateRangeQuery { Start = "2026-11-10", End = "2026-11-10" }, TODAY);

        range.TotalDays.Should().Be(1);
    }

    [Theory]
    [InlineData("2026-11-01", null)]
    [InlineData(null, "2026-11-15")]
    [InlineData("2026-11-01", "2026-11-15")]
    public void Resolve_ShouldThrowValidation_WhenMonthIsCombinedWithInterval(string? start, string? end)
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Month = "2026-11", Start = start, End = end }, TODAY);

        act.Should().Throw<ValidationException>()
            .Which.Errors.Should().ContainSingle(e => e.Field == "month");
    }

    [Fact]
    public void Resolve_ShouldThrowValidation_WhenStartIsAfterEnd()
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Start = "2026-11-16", End = "2026-11-15" }, TODAY);

        act.Should().Throw<ValidationException>()
            .Which.Errors.Should().ContainSingle(e => e.Field == "start");
    }

    [Fact]
    public void Resolve_ShouldThrowValidation_WhenIntervalHasMoreThan366Days()
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Start = "2025-01-01", End = "2026-01-02" }, TODAY);

        act.Should().Throw<ValidationException>().WithMessage("*366*");
    }

    [Fact]
    public void Resolve_ShouldAccept366Days_WhenIntervalIsAtTheLimit()
    {
        var range = DateRangeResolver.Resolve(new DateRangeQuery { Start = "2024-01-01", End = "2024-12-31" }, TODAY);

        range.TotalDays.Should().Be(366);
    }

    [Theory]
    [InlineData("2026-11-01", null, "end")]
    [InlineData(null, "2026-11-15", "start")]
    public void Resolve_ShouldThrowValidation_WhenOnlyOneEndOfTheIntervalIsGiven(string? start, string? end, string field)
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Start = start, End = end }, TODAY);

        act.Should().Throw<ValidationException>()
            .Which.Errors.Should().ContainSingle(e => e.Field == field);
    }

    [Theory]
    [InlineData("2026-13")]
    [InlineData("11/2026")]
    [InlineData("2026-1")]
    public void Resolve_ShouldThrowValidation_WhenMonthFormatIsInvalid(string month)
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Month = month }, TODAY);

        act.Should().Throw<ValidationException>()
            .Which.Errors.Should().ContainSingle(e => e.Field == "month");
    }

    [Theory]
    [InlineData("2026-11-31", "2026-12-01", "start")]
    [InlineData("2026-11-01", "01/12/2026", "end")]
    public void Resolve_ShouldThrowValidation_WhenDateFormatIsInvalid(string start, string end, string field)
    {
        var act = () => DateRangeResolver.Resolve(new DateRangeQuery { Start = start, End = end }, TODAY);

        act.Should().Throw<ValidationException>()
            .Which.Errors.Should().ContainSingle(e => e.Field == field);
    }
}
