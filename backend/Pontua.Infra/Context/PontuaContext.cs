using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Pontua.Infra.Context;

/// <summary>
/// Contexto EF Core do Pontua (data-model.md). Princípio V: tabelas snake_case no plural, PK
/// <c>{entidade}_id</c> identity com constraint <c>{tabela}_pkey</c>, FKs <c>fk_{pai}_{filho}</c> com
/// <c>ClientSetNull</c>, instantes em <c>timestamp without time zone</c> (UTC), enums como <c>integer</c>.
/// </summary>
public class PontuaContext : DbContext
{
    private const string UTC_NOW_SQL = "(now() at time zone 'utc')";

    public const string USERS_EMAIL_INDEX = "ix_users_email";
    public const string USERS_GOOGLE_SUBJECT_INDEX = "ix_users_google_subject";
    public const string POSITIONS_COMPANY_NAME_INDEX = "ix_positions_company_name";
    public const string MEMBERS_COMPANY_USER_INDEX = "ix_members_company_user";
    public const string MEMBER_POSITIONS_MEMBER_DATE_INDEX = "ix_member_positions_member_effective_from";
    public const string MANAGER_POSITIONS_MEMBER_POSITION_INDEX = "ix_manager_positions_member_position";
    public const string SCHEDULES_POSITION_DATE_INDEX = "ix_schedules_position_effective_from";
    public const string SCHEDULES_MEMBER_DATE_INDEX = "ix_schedules_member_effective_from";
    public const string SCHEDULES_OWNER_CHECK = "schedules_owner_ck";
    public const string INVITATIONS_TOKEN_INDEX = "ix_invitations_token";
    public const string PUNCHES_COMPANY_NSR_INDEX = "ix_punches_company_nsr";
    public const string PUNCHES_MEMBER_CLIENT_INDEX = "ix_punches_member_client";

    public PontuaContext(DbContextOptions<PontuaContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<MemberPosition> MemberPositions => Set<MemberPosition>();
    public DbSet<ManagerPosition> ManagerPositions => Set<ManagerPosition>();
    public DbSet<Schedule> Schedules => Set<Schedule>();
    public DbSet<ScheduleDay> ScheduleDays => Set<ScheduleDay>();
    public DbSet<SchedulePeriod> SchedulePeriods => Set<SchedulePeriod>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Punch> Punches => Set<Punch>();
    public DbSet<PunchStatusChange> PunchStatusChanges => Set<PunchStatusChange>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Princípio V / R-06: timestamp without time zone, sempre gravado e lido como UTC.
        configurationBuilder.Properties<DateTime>()
            .HaveConversion<UtcDateTimeConverter>()
            .HaveColumnType("timestamp without time zone");
        configurationBuilder.Properties<DateTime?>()
            .HaveConversion<NullableUtcDateTimeConverter>()
            .HaveColumnType("timestamp without time zone");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        ConfigureUsers(modelBuilder);
        ConfigureCompanies(modelBuilder);
        ConfigurePositions(modelBuilder);
        ConfigureMembers(modelBuilder);
        ConfigureMemberPositions(modelBuilder);
        ConfigureManagerPositions(modelBuilder);
        ConfigureSchedules(modelBuilder);
        ConfigureInvitations(modelBuilder);
        ConfigurePunches(modelBuilder);
        ConfigurePunchStatusChanges(modelBuilder);
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.UserId).HasName("users_pkey");
            entity.Property(e => e.UserId).HasColumnName("user_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(254).IsRequired();
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(256);
            entity.Property(e => e.GoogleSubject).HasColumnName("google_subject").HasMaxLength(64);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Ignore(e => e.HasPassword);
            entity.Ignore(e => e.HasGoogle);

            entity.HasIndex(e => e.Email).IsUnique().HasDatabaseName(USERS_EMAIL_INDEX);
            entity.HasIndex(e => e.GoogleSubject).IsUnique()
                .HasFilter("google_subject IS NOT NULL").HasDatabaseName(USERS_GOOGLE_SUBJECT_INDEX);
        });
    }

    private static void ConfigureCompanies(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(entity =>
        {
            entity.ToTable("companies");
            entity.HasKey(e => e.CompanyId).HasName("companies_pkey");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(160).IsRequired();
            entity.Property(e => e.Document).HasColumnName("document").HasMaxLength(20);
            entity.Property(e => e.TimeZone).HasColumnName("time_zone").HasMaxLength(64).IsRequired()
                .HasDefaultValue(Company.DEFAULT_TIME_ZONE);
            entity.Property(e => e.ManualRetroDays).HasColumnName("manual_retro_days")
                .HasDefaultValue(Company.DEFAULT_MANUAL_RETRO_DAYS).HasSentinel(0);
            entity.Property(e => e.OwnerUserId).HasColumnName("owner_user_id");
            entity.Property(e => e.LastNsr).HasColumnName("last_nsr").HasDefaultValue(0L);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<User>().WithMany().HasForeignKey(e => e.OwnerUserId)
                .HasConstraintName("fk_user_company").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasIndex(e => e.OwnerUserId).HasDatabaseName("ix_companies_owner_user_id");
        });
    }

    private static void ConfigurePositions(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Position>(entity =>
        {
            entity.ToTable("positions");
            entity.HasKey(e => e.PositionId).HasName("positions_pkey");
            entity.Property(e => e.PositionId).HasColumnName("position_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId)
                .HasConstraintName("fk_company_position").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasIndex(e => new { e.CompanyId, e.Name }).IsUnique().HasDatabaseName(POSITIONS_COMPANY_NAME_INDEX);
        });
    }

    private static void ConfigureMembers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("members");
            entity.HasKey(e => e.MemberId).HasName("members_pkey");
            entity.Property(e => e.MemberId).HasColumnName("member_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>()
                .HasDefaultValue(MemberStatus.Active).HasSentinel((MemberStatus)0);
            entity.Property(e => e.IsManager).HasColumnName("is_manager").HasDefaultValue(false);
            entity.Property(e => e.JoinedAt).HasColumnName("joined_at");
            entity.Property(e => e.ActiveSince).HasColumnName("active_since").HasColumnType("date");
            entity.Property(e => e.DeactivatedAt).HasColumnName("deactivated_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql(UTC_NOW_SQL);
            entity.Ignore(e => e.IsActive);

            entity.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId)
                .HasConstraintName("fk_company_member").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_user_member").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.CompanyId, e.UserId }).IsUnique().HasDatabaseName(MEMBERS_COMPANY_USER_INDEX);
            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_members_user_id");
        });
    }

    private static void ConfigureMemberPositions(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MemberPosition>(entity =>
        {
            entity.ToTable("member_positions");
            entity.HasKey(e => e.MemberPositionId).HasName("member_positions_pkey");
            entity.Property(e => e.MemberPositionId).HasColumnName("member_position_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.MemberId).HasColumnName("member_id");
            entity.Property(e => e.PositionId).HasColumnName("position_id");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<Member>().WithMany().HasForeignKey(e => e.MemberId)
                .HasConstraintName("fk_member_member_position").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(e => e.Position).WithMany().HasForeignKey(e => e.PositionId)
                .HasConstraintName("fk_position_member_position").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_member_position").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.MemberId, e.EffectiveFrom }).IsUnique()
                .HasDatabaseName(MEMBER_POSITIONS_MEMBER_DATE_INDEX);
            entity.HasIndex(e => e.PositionId).HasDatabaseName("ix_member_positions_position_id");
            entity.HasIndex(e => e.CreatedByUserId).HasDatabaseName("ix_member_positions_created_by_user_id");
        });
    }

    private static void ConfigureManagerPositions(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ManagerPosition>(entity =>
        {
            entity.ToTable("manager_positions");
            entity.HasKey(e => e.ManagerPositionId).HasName("manager_positions_pkey");
            entity.Property(e => e.ManagerPositionId).HasColumnName("manager_position_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.MemberId).HasColumnName("member_id");
            entity.Property(e => e.PositionId).HasColumnName("position_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<Member>().WithMany().HasForeignKey(e => e.MemberId)
                .HasConstraintName("fk_member_manager_position").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Position>().WithMany().HasForeignKey(e => e.PositionId)
                .HasConstraintName("fk_position_manager_position").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.MemberId, e.PositionId }).IsUnique()
                .HasDatabaseName(MANAGER_POSITIONS_MEMBER_POSITION_INDEX);
            entity.HasIndex(e => e.PositionId).HasDatabaseName("ix_manager_positions_position_id");
        });
    }

    private static void ConfigureSchedules(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Schedule>(entity =>
        {
            entity.ToTable("schedules", table => table.HasCheckConstraint(SCHEDULES_OWNER_CHECK,
                "(position_id IS NULL) <> (member_id IS NULL)"));
            entity.HasKey(e => e.ScheduleId).HasName("schedules_pkey");
            entity.Property(e => e.ScheduleId).HasColumnName("schedule_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.PositionId).HasColumnName("position_id");
            entity.Property(e => e.MemberId).HasColumnName("member_id");
            entity.Property(e => e.InheritsPosition).HasColumnName("inherits_position").HasDefaultValue(false);
            entity.Property(e => e.Mode).HasColumnName("mode").HasConversion<int>()
                .HasDefaultValue(ScheduleMode.Weekly).HasSentinel((ScheduleMode)0);
            entity.Property(e => e.WeeklyMinutes).HasColumnName("weekly_minutes");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId)
                .HasConstraintName("fk_company_schedule").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Position>().WithMany().HasForeignKey(e => e.PositionId)
                .HasConstraintName("fk_position_schedule").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Member>().WithMany().HasForeignKey(e => e.MemberId)
                .HasConstraintName("fk_member_schedule").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_schedule").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasMany(e => e.Days).WithOne().HasForeignKey(d => d.ScheduleId)
                .HasConstraintName("fk_schedule_schedule_day").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasMany(e => e.Periods).WithOne().HasForeignKey(p => p.ScheduleId)
                .HasConstraintName("fk_schedule_schedule_period").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.PositionId, e.EffectiveFrom }).IsUnique()
                .HasFilter("position_id IS NOT NULL").HasDatabaseName(SCHEDULES_POSITION_DATE_INDEX);
            entity.HasIndex(e => new { e.MemberId, e.EffectiveFrom }).IsUnique()
                .HasFilter("member_id IS NOT NULL").HasDatabaseName(SCHEDULES_MEMBER_DATE_INDEX);
            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_schedules_company_id");
            entity.HasIndex(e => e.CreatedByUserId).HasDatabaseName("ix_schedules_created_by_user_id");
        });

        modelBuilder.Entity<ScheduleDay>(entity =>
        {
            entity.ToTable("schedule_days");
            entity.HasKey(e => e.ScheduleDayId).HasName("schedule_days_pkey");
            entity.Property(e => e.ScheduleDayId).HasColumnName("schedule_day_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.ScheduleId).HasColumnName("schedule_id");
            entity.Property(e => e.DayOfWeek).HasColumnName("day_of_week").HasConversion<int>();
            entity.Property(e => e.DailyMinutes).HasColumnName("daily_minutes");

            entity.HasIndex(e => new { e.ScheduleId, e.DayOfWeek }).IsUnique()
                .HasDatabaseName("ix_schedule_days_schedule_day_of_week");
        });

        modelBuilder.Entity<SchedulePeriod>(entity =>
        {
            entity.ToTable("schedule_periods");
            entity.HasKey(e => e.SchedulePeriodId).HasName("schedule_periods_pkey");
            entity.Property(e => e.SchedulePeriodId).HasColumnName("schedule_period_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.ScheduleId).HasColumnName("schedule_id");
            entity.Property(e => e.DayOfWeek).HasColumnName("day_of_week").HasConversion<int?>();
            entity.Property(e => e.Sequence).HasColumnName("sequence");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(40).IsRequired();
            entity.Property(e => e.ExpectedTime).HasColumnName("expected_time").HasColumnType("time without time zone");

            // day_of_week é nulo no modo semanal: NULLS NOT DISTINCT (PostgreSQL 15+) mantém a unicidade da sequência.
            entity.HasIndex(e => new { e.ScheduleId, e.DayOfWeek, e.Sequence }).IsUnique()
                .AreNullsDistinct(false).HasDatabaseName("ix_schedule_periods_schedule_day_sequence");
        });
    }

    private static void ConfigureInvitations(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Invitation>(entity =>
        {
            entity.ToTable("invitations");
            entity.HasKey(e => e.InvitationId).HasName("invitations_pkey");
            entity.Property(e => e.InvitationId).HasColumnName("invitation_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.PositionId).HasColumnName("position_id");
            entity.Property(e => e.Token).HasColumnName("token").HasMaxLength(64).IsRequired();
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.AcceptedCount).HasColumnName("accepted_count").HasDefaultValue(0);
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql(UTC_NOW_SQL);

            entity.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId)
                .HasConstraintName("fk_company_invitation").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Position>().WithMany().HasForeignKey(e => e.PositionId)
                .HasConstraintName("fk_position_invitation").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_invitation").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.Token).IsUnique().HasDatabaseName(INVITATIONS_TOKEN_INDEX);
            entity.HasIndex(e => new { e.CompanyId, e.CreatedAt }).HasDatabaseName("ix_invitations_company_created_at");
            entity.HasIndex(e => e.PositionId).HasDatabaseName("ix_invitations_position_id");
            entity.HasIndex(e => e.CreatedByUserId).HasDatabaseName("ix_invitations_created_by_user_id");
        });
    }

    private static void ConfigurePunches(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Punch>(entity =>
        {
            entity.ToTable("punches");
            entity.HasKey(e => e.PunchId).HasName("punches_pkey");
            entity.Property(e => e.PunchId).HasColumnName("punch_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.MemberId).HasColumnName("member_id");
            entity.Property(e => e.Nsr).HasColumnName("nsr");
            entity.Property(e => e.Kind).HasColumnName("kind").HasConversion<int>();
            entity.Property(e => e.PunchedAt).HasColumnName("punched_at");
            entity.Property(e => e.WorkDate).HasColumnName("work_date").HasColumnType("date");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<int>();
            entity.Property(e => e.PendingReason).HasColumnName("pending_reason").HasConversion<int?>();
            entity.Property(e => e.Justification).HasColumnName("justification").HasMaxLength(Punch.JUSTIFICATION_MAX_LENGTH);
            entity.Property(e => e.ReplacesPunchId).HasColumnName("replaces_punch_id");
            entity.Property(e => e.ClientId).HasColumnName("client_id").HasColumnType("uuid");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Ignore(e => e.CountsAsWorked);
            entity.Ignore(e => e.IsEffective);

            entity.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId)
                .HasConstraintName("fk_company_punch").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Member>().WithMany().HasForeignKey(e => e.MemberId)
                .HasConstraintName("fk_member_punch").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<Punch>().WithMany().HasForeignKey(e => e.ReplacesPunchId)
                .HasConstraintName("fk_punch_punch").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedByUserId)
                .HasConstraintName("fk_user_punch").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => new { e.CompanyId, e.Nsr }).IsUnique().HasDatabaseName(PUNCHES_COMPANY_NSR_INDEX);
            entity.HasIndex(e => new { e.CompanyId, e.WorkDate }).HasDatabaseName("ix_punches_company_work_date");
            entity.HasIndex(e => new { e.MemberId, e.WorkDate }).HasDatabaseName("ix_punches_member_work_date");
            entity.HasIndex(e => new { e.CompanyId, e.Status }).HasFilter("status = 2")
                .HasDatabaseName("ix_punches_company_pending");
            entity.HasIndex(e => new { e.MemberId, e.ClientId }).IsUnique()
                .HasFilter("client_id IS NOT NULL").HasDatabaseName(PUNCHES_MEMBER_CLIENT_INDEX);
            entity.HasIndex(e => e.ReplacesPunchId).HasFilter("replaces_punch_id IS NOT NULL")
                .HasDatabaseName("ix_punches_replaces_punch_id");
            entity.HasIndex(e => e.CreatedByUserId).HasDatabaseName("ix_punches_created_by_user_id");
        });
    }

    private static void ConfigurePunchStatusChanges(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PunchStatusChange>(entity =>
        {
            entity.ToTable("punch_status_changes");
            entity.HasKey(e => e.PunchStatusChangeId).HasName("punch_status_changes_pkey");
            entity.Property(e => e.PunchStatusChangeId).HasColumnName("punch_status_change_id").UseIdentityByDefaultColumn();
            entity.Property(e => e.PunchId).HasColumnName("punch_id");
            entity.Property(e => e.FromStatus).HasColumnName("from_status").HasConversion<int?>();
            entity.Property(e => e.ToStatus).HasColumnName("to_status").HasConversion<int>();
            entity.Property(e => e.ChangedByUserId).HasColumnName("changed_by_user_id");
            entity.Property(e => e.Note).HasColumnName("note").HasMaxLength(500);
            entity.Property(e => e.ChangedAt).HasColumnName("changed_at");

            entity.HasOne<Punch>().WithMany().HasForeignKey(e => e.PunchId)
                .HasConstraintName("fk_punch_punch_status_change").OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.ChangedByUserId)
                .HasConstraintName("fk_user_punch_status_change").OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasIndex(e => e.PunchId).HasDatabaseName("ix_punch_status_changes_punch_id");
            entity.HasIndex(e => e.ChangedByUserId).HasDatabaseName("ix_punch_status_changes_changed_by_user_id");
        });
    }

    private sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter() : base(
            v => DateTime.SpecifyKind(v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v, DateTimeKind.Unspecified),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    private sealed class NullableUtcDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public NullableUtcDateTimeConverter() : base(
            v => v.HasValue
                ? DateTime.SpecifyKind(v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v.Value, DateTimeKind.Unspecified)
                : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        {
        }
    }
}
