using Microsoft.AspNetCore.Identity;
using PetGest.Api.Data.Entities;
using PetGest.Api.Services;

namespace PetGest.Api.Tests.Auth;

// Requisito "Senhas das contas importadas do V0" da spec api-auth — unidade do hasher.
// O caminho completo (login pela API regravando o hash) está em PasswordCompatibilityApiTests.
public class PasswordCompatibilityTests
{
    private readonly CompatPasswordHasher _hasher = new();
    private readonly AppUser _user = new() { Id = Guid.NewGuid() };

    [Theory]
    [InlineData("$2a$")]
    [InlineData("$2b$")]
    [InlineData("$2y$")]
    public void Hash_bcrypt_com_senha_certa_pede_regravacao(string prefix)
    {
        var hash = prefix + BCrypt.Net.BCrypt.HashPassword("senha-do-v0", workFactor: 4)[4..];

        Assert.Equal(PasswordVerificationResult.SuccessRehashNeeded,
            _hasher.VerifyHashedPassword(_user, hash, "senha-do-v0"));
    }

    [Fact]
    public void Hash_bcrypt_com_senha_errada_falha()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("senha-do-v0", workFactor: 4);

        Assert.Equal(PasswordVerificationResult.Failed, _hasher.VerifyHashedPassword(_user, hash, "outra"));
    }

    [Fact]
    public void Hash_bcrypt_corrompido_falha_sem_excecao()
    {
        Assert.Equal(PasswordVerificationResult.Failed, _hasher.VerifyHashedPassword(_user, "$2a$xx", "qualquer"));
    }

    [Fact]
    public void Hash_padrao_do_Identity_continua_igual()
    {
        var hash = _hasher.HashPassword(_user, "senha-nova");

        Assert.False(CompatPasswordHasher.IsBcrypt(hash));
        Assert.Equal(PasswordVerificationResult.Success, _hasher.VerifyHashedPassword(_user, hash, "senha-nova"));
        Assert.Equal(PasswordVerificationResult.Failed, _hasher.VerifyHashedPassword(_user, hash, "errada"));
    }
}
