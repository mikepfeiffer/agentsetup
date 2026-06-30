using System.Net;
using System.Net.Http.Json;
using CatalogApi.Models;
using Xunit;

namespace CatalogApi.Tests;

public class CatalogApiTests : IClassFixture<CatalogApiFactory>
{
    private readonly CatalogApiFactory _factory;

    public CatalogApiTests(CatalogApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Get_products_returns_seeded_items()
    {
        var client = _factory.CreateClient();

        var products = await client.GetFromJsonAsync<List<Product>>("/products");

        Assert.NotNull(products);
        Assert.True(products!.Count >= 2);
    }

    [Fact]
    public async Task Post_valid_product_returns_201_and_echoes_decimal_price()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/products", new { name = "Sprocket", price = 4.50m });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Product>();
        Assert.NotNull(created);
        Assert.Equal("Sprocket", created!.Name);
        Assert.Equal(4.50m, created.Price);
    }

    [Fact]
    public async Task Post_invalid_product_returns_400_problem()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/products", new { name = "", price = -1m });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_missing_product_returns_404_problem()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/products/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
