namespace CatalogApi.Models;

/// <summary>A catalog product. Prices are <see cref="decimal"/> — never double/float.</summary>
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    // Money is decimal in .NET: exact base-10, no binary rounding error. See AGENTS.md.
    public decimal Price { get; set; }
}

/// <summary>Request body for creating a product. Validated at the edge before use.</summary>
public record CreateProductRequest(string? Name, decimal Price);
