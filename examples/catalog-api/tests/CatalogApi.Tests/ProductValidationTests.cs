using CatalogApi.Models;
using Xunit;

namespace CatalogApi.Tests;

public class ProductValidationTests
{
    [Fact]
    public void Rejects_empty_name()
    {
        var errors = ProductValidation.Validate(new CreateProductRequest("  ", 1m));
        Assert.True(errors.ContainsKey("Name"));
    }

    [Fact]
    public void Rejects_negative_price()
    {
        var errors = ProductValidation.Validate(new CreateProductRequest("Widget", -1m));
        Assert.True(errors.ContainsKey("Price"));
    }

    [Fact]
    public void Accepts_valid_request()
    {
        var errors = ProductValidation.Validate(new CreateProductRequest("Widget", 0m));
        Assert.Empty(errors);
    }
}
