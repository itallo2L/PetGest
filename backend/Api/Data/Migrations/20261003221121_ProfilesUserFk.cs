using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetGest.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProfilesUserFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No banco de produção, profiles_id_fkey ainda aponta para auth.users (V0). Na
            // T-18 esta migration roda depois de importar as contas para identity.users com
            // os mesmos ids (design D2 da T-14); em bancos novos o drop não faz nada.
            migrationBuilder.Sql("alter table public.profiles drop constraint if exists profiles_id_fkey;");

            migrationBuilder.AddForeignKey(
                name: "profiles_id_fkey",
                table: "profiles",
                column: "id",
                principalSchema: "identity",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "profiles_id_fkey",
                table: "profiles");
        }
    }
}
