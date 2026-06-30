namespace CatalogApi.Models;

/// <summary>
/// Edge validation for product input. Pure and side-effect free so it is easy to
/// unit-test and reuse. Returns a field -> messages map suitable for
/// <c>Results.ValidationProblem</c> (RFC 7807 ProblemDetails).
/// </summary>
public static class ProductValidation
{
    public static Dictionary<string, string[]> Validate(CreateProductRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
            errors[nameof(request.Name)] = new[] { "Name is required." };

        if (request.Price < 0m)
            errors[nameof(request.Price)] = new[] { "Price must be zero or greater." };

        return errors;
    }
}
