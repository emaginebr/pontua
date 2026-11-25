using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Pontua.Infra.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        private const string PUNCHES_IMMUTABLE_UP_SQL = @"
CREATE OR REPLACE FUNCTION punches_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'punches_immutable: marcações não podem ser excluídas (punch_id=%).', OLD.punch_id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'punches_immutable: marcações não podem ser excluídas.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
        RAISE EXCEPTION 'punches_immutable: só a coluna status pode ser alterada (punch_id=%).', OLD.punch_id
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER punches_immutable
    BEFORE UPDATE OR DELETE ON punches
    FOR EACH ROW EXECUTE FUNCTION punches_immutable();

CREATE TRIGGER punches_immutable_truncate
    BEFORE TRUNCATE ON punches
    FOR EACH STATEMENT EXECUTE FUNCTION punches_immutable();
";

        private const string PUNCHES_IMMUTABLE_DOWN_SQL = @"
DROP TRIGGER IF EXISTS punches_immutable_truncate ON punches;
DROP TRIGGER IF EXISTS punches_immutable ON punches;
DROP FUNCTION IF EXISTS punches_immutable();
";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    google_subject = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("users_pkey", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    document = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    time_zone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "America/Sao_Paulo"),
                    manual_retro_days = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                    owner_user_id = table.Column<long>(type: "bigint", nullable: false),
                    last_nsr = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("companies_pkey", x => x.company_id);
                    table.ForeignKey(
                        name: "fk_user_company",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "members",
                columns: table => new
                {
                    member_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    is_manager = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    joined_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    active_since = table.Column<DateOnly>(type: "date", nullable: false),
                    deactivated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("members_pkey", x => x.member_id);
                    table.ForeignKey(
                        name: "fk_company_member",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "company_id");
                    table.ForeignKey(
                        name: "fk_user_member",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "positions",
                columns: table => new
                {
                    position_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("positions_pkey", x => x.position_id);
                    table.ForeignKey(
                        name: "fk_company_position",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "company_id");
                });

            migrationBuilder.CreateTable(
                name: "punches",
                columns: table => new
                {
                    punch_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    member_id = table.Column<long>(type: "bigint", nullable: false),
                    nsr = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    punched_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    work_date = table.Column<DateOnly>(type: "date", nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    pending_reason = table.Column<int>(type: "integer", nullable: true),
                    justification = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    replaces_punch_id = table.Column<long>(type: "bigint", nullable: true),
                    client_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("punches_pkey", x => x.punch_id);
                    table.ForeignKey(
                        name: "fk_company_punch",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "company_id");
                    table.ForeignKey(
                        name: "fk_member_punch",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "member_id");
                    table.ForeignKey(
                        name: "fk_punch_punch",
                        column: x => x.replaces_punch_id,
                        principalTable: "punches",
                        principalColumn: "punch_id");
                    table.ForeignKey(
                        name: "fk_user_punch",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "invitations",
                columns: table => new
                {
                    invitation_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    position_id = table.Column<long>(type: "bigint", nullable: false),
                    token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    accepted_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("invitations_pkey", x => x.invitation_id);
                    table.ForeignKey(
                        name: "fk_company_invitation",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "company_id");
                    table.ForeignKey(
                        name: "fk_position_invitation",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "position_id");
                    table.ForeignKey(
                        name: "fk_user_invitation",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "manager_positions",
                columns: table => new
                {
                    manager_position_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    member_id = table.Column<long>(type: "bigint", nullable: false),
                    position_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("manager_positions_pkey", x => x.manager_position_id);
                    table.ForeignKey(
                        name: "fk_member_manager_position",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "member_id");
                    table.ForeignKey(
                        name: "fk_position_manager_position",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "position_id");
                });

            migrationBuilder.CreateTable(
                name: "member_positions",
                columns: table => new
                {
                    member_position_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    member_id = table.Column<long>(type: "bigint", nullable: false),
                    position_id = table.Column<long>(type: "bigint", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("member_positions_pkey", x => x.member_position_id);
                    table.ForeignKey(
                        name: "fk_member_member_position",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "member_id");
                    table.ForeignKey(
                        name: "fk_position_member_position",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "position_id");
                    table.ForeignKey(
                        name: "fk_user_member_position",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "schedules",
                columns: table => new
                {
                    schedule_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    position_id = table.Column<long>(type: "bigint", nullable: true),
                    member_id = table.Column<long>(type: "bigint", nullable: true),
                    inherits_position = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    mode = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    weekly_minutes = table.Column<int>(type: "integer", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "(now() at time zone 'utc')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("schedules_pkey", x => x.schedule_id);
                    table.CheckConstraint("schedules_owner_ck", "(position_id IS NULL) <> (member_id IS NULL)");
                    table.ForeignKey(
                        name: "fk_company_schedule",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "company_id");
                    table.ForeignKey(
                        name: "fk_member_schedule",
                        column: x => x.member_id,
                        principalTable: "members",
                        principalColumn: "member_id");
                    table.ForeignKey(
                        name: "fk_position_schedule",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "position_id");
                    table.ForeignKey(
                        name: "fk_user_schedule",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "punch_status_changes",
                columns: table => new
                {
                    punch_status_change_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    punch_id = table.Column<long>(type: "bigint", nullable: false),
                    from_status = table.Column<int>(type: "integer", nullable: true),
                    to_status = table.Column<int>(type: "integer", nullable: false),
                    changed_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    changed_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("punch_status_changes_pkey", x => x.punch_status_change_id);
                    table.ForeignKey(
                        name: "fk_punch_punch_status_change",
                        column: x => x.punch_id,
                        principalTable: "punches",
                        principalColumn: "punch_id");
                    table.ForeignKey(
                        name: "fk_user_punch_status_change",
                        column: x => x.changed_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id");
                });

            migrationBuilder.CreateTable(
                name: "schedule_days",
                columns: table => new
                {
                    schedule_day_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    schedule_id = table.Column<long>(type: "bigint", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    daily_minutes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("schedule_days_pkey", x => x.schedule_day_id);
                    table.ForeignKey(
                        name: "fk_schedule_schedule_day",
                        column: x => x.schedule_id,
                        principalTable: "schedules",
                        principalColumn: "schedule_id");
                });

            migrationBuilder.CreateTable(
                name: "schedule_periods",
                columns: table => new
                {
                    schedule_period_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    schedule_id = table.Column<long>(type: "bigint", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    expected_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("schedule_periods_pkey", x => x.schedule_period_id);
                    table.ForeignKey(
                        name: "fk_schedule_schedule_period",
                        column: x => x.schedule_id,
                        principalTable: "schedules",
                        principalColumn: "schedule_id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_companies_owner_user_id",
                table: "companies",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_invitations_company_created_at",
                table: "invitations",
                columns: new[] { "company_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_invitations_created_by_user_id",
                table: "invitations",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_invitations_position_id",
                table: "invitations",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_invitations_token",
                table: "invitations",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_manager_positions_member_position",
                table: "manager_positions",
                columns: new[] { "member_id", "position_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_manager_positions_position_id",
                table: "manager_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_positions_created_by_user_id",
                table: "member_positions",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_positions_member_effective_from",
                table: "member_positions",
                columns: new[] { "member_id", "effective_from" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_member_positions_position_id",
                table: "member_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_members_company_user",
                table: "members",
                columns: new[] { "company_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_members_user_id",
                table: "members",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_positions_company_name",
                table: "positions",
                columns: new[] { "company_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_punch_status_changes_changed_by_user_id",
                table: "punch_status_changes",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_punch_status_changes_punch_id",
                table: "punch_status_changes",
                column: "punch_id");

            migrationBuilder.CreateIndex(
                name: "ix_punches_company_nsr",
                table: "punches",
                columns: new[] { "company_id", "nsr" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_punches_company_pending",
                table: "punches",
                columns: new[] { "company_id", "status" },
                filter: "status = 2");

            migrationBuilder.CreateIndex(
                name: "ix_punches_company_work_date",
                table: "punches",
                columns: new[] { "company_id", "work_date" });

            migrationBuilder.CreateIndex(
                name: "ix_punches_created_by_user_id",
                table: "punches",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_punches_member_client",
                table: "punches",
                columns: new[] { "member_id", "client_id" },
                unique: true,
                filter: "client_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_punches_member_work_date",
                table: "punches",
                columns: new[] { "member_id", "work_date" });

            migrationBuilder.CreateIndex(
                name: "ix_punches_replaces_punch_id",
                table: "punches",
                column: "replaces_punch_id",
                filter: "replaces_punch_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_schedule_days_schedule_day_of_week",
                table: "schedule_days",
                columns: new[] { "schedule_id", "day_of_week" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_schedule_periods_schedule_day_sequence",
                table: "schedule_periods",
                columns: new[] { "schedule_id", "day_of_week", "sequence" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_schedules_company_id",
                table: "schedules",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedules_created_by_user_id",
                table: "schedules",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_schedules_member_effective_from",
                table: "schedules",
                columns: new[] { "member_id", "effective_from" },
                unique: true,
                filter: "member_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_schedules_position_effective_from",
                table: "schedules",
                columns: new[] { "position_id", "effective_from" },
                unique: true,
                filter: "position_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_google_subject",
                table: "users",
                column: "google_subject",
                unique: true,
                filter: "google_subject IS NOT NULL");

            // R-04 / FR-022a: marcações imutáveis. Bloqueia DELETE, TRUNCATE e qualquer UPDATE que altere
            // colunas diferentes de status. A comparação via jsonb cobre também colunas adicionadas no futuro.
            migrationBuilder.Sql(PUNCHES_IMMUTABLE_UP_SQL);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(PUNCHES_IMMUTABLE_DOWN_SQL);

            migrationBuilder.DropTable(
                name: "invitations");

            migrationBuilder.DropTable(
                name: "manager_positions");

            migrationBuilder.DropTable(
                name: "member_positions");

            migrationBuilder.DropTable(
                name: "punch_status_changes");

            migrationBuilder.DropTable(
                name: "schedule_days");

            migrationBuilder.DropTable(
                name: "schedule_periods");

            migrationBuilder.DropTable(
                name: "punches");

            migrationBuilder.DropTable(
                name: "schedules");

            migrationBuilder.DropTable(
                name: "members");

            migrationBuilder.DropTable(
                name: "positions");

            migrationBuilder.DropTable(
                name: "companies");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
