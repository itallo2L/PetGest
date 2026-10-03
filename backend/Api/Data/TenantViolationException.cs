namespace PetGest.Api.Data;

// Gravação recusada por tocar dados de outro petshop (ou sem petshop). Nada é gravado.
// A T-15 traduz para a resposta HTTP.
public class TenantViolationException(string message) : InvalidOperationException(message);
