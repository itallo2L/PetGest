using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data.Configurations;

// Tabelas do Identity no schema próprio `identity`, fora do schema `public` exposto
// pela Data API do Supabase (T-11 D2; design D1 da T-14). Aplicadas depois do
// base.OnModelCreating do IdentityUserContext, que define chaves e tamanhos.
public static class IdentitySchema
{
    public const string Name = "identity";
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.ToTable("users", IdentitySchema.Name);
        builder.HasKey(u => u.Id).HasName("users_pkey");

        builder.HasIndex(u => u.NormalizedUserName).HasDatabaseName("users_normalized_user_name_key").IsUnique();
        // O Identity cria este índice não único e só confere duplicidade antes de gravar;
        // único aqui, dois cadastros simultâneos com o mesmo e-mail não passam.
        builder.HasIndex(u => u.NormalizedEmail).HasDatabaseName("users_normalized_email_key").IsUnique();
    }
}

public class UserClaimConfiguration : IEntityTypeConfiguration<IdentityUserClaim<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserClaim<Guid>> builder)
    {
        builder.ToTable("user_claims", IdentitySchema.Name);
        builder.HasKey(c => c.Id).HasName("user_claims_pkey");
    }
}

public class UserLoginConfiguration : IEntityTypeConfiguration<IdentityUserLogin<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserLogin<Guid>> builder)
    {
        builder.ToTable("user_logins", IdentitySchema.Name);
        builder.HasKey(l => new { l.LoginProvider, l.ProviderKey }).HasName("user_logins_pkey");
    }
}

public class UserTokenConfiguration : IEntityTypeConfiguration<IdentityUserToken<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserToken<Guid>> builder)
    {
        builder.ToTable("user_tokens", IdentitySchema.Name);
        builder.HasKey(t => new { t.UserId, t.LoginProvider, t.Name }).HasName("user_tokens_pkey");
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens", IdentitySchema.Name);
        builder.HasKey(t => t.Id).HasName("refresh_tokens_pkey");
        builder.Property(t => t.TokenHash).HasColumnType("text");

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .HasConstraintName("refresh_tokens_user_id_fkey")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.TokenHash).IsUnique().HasDatabaseName("refresh_tokens_token_hash_key");
        builder.HasIndex(t => t.FamilyId).HasDatabaseName("refresh_tokens_family_id_idx");
        builder.HasIndex(t => t.UserId).HasDatabaseName("refresh_tokens_user_id_idx");
    }
}

// Chaves do Data Protection (design D1 da T-17): assinam os códigos de confirmação de
// e-mail e de redefinição de senha. Sem filtro de tenant, como as contas.
public class DataProtectionKeyConfiguration : IEntityTypeConfiguration<DataProtectionKey>
{
    public void Configure(EntityTypeBuilder<DataProtectionKey> builder)
    {
        builder.ToTable("data_protection_keys", IdentitySchema.Name);
        builder.HasKey(k => k.Id).HasName("data_protection_keys_pkey");
    }
}
