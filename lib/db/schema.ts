import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  unique,
  uniqueIndex,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/*
  Public-schema tables (source of truth for structure + app types).
  Supabase-specific concerns — the auth.users foreign keys, RLS, policies, and
  the profile-provisioning trigger — live in the companion custom SQL migration
  (lib/db/migrations/*_supabase_rls.sql), since drizzle does not model them.

  Distance unit convention (no unit column): distances are stored in the lie's
  natural unit — FEET when the lie is `green`, YARDS otherwise. The SG engine and
  UI derive the unit from the lie. This matches the benchmark reference data.
*/

// --- Enums -------------------------------------------------------------------
export const lieEnum = pgEnum("lie", [
  "tee",
  "fairway",
  "rough",
  "sand",
  "recovery",
  "green",
]);

export const roundStatusEnum = pgEnum("round_status", [
  "in_progress",
  "complete",
]);

export const sgCategoryEnum = pgEnum("sg_category", [
  "ott",
  "app",
  "arg",
  "putt",
]);

// --- Puttmaxx enums ----------------------------------------------------------
// Slope along the line of the putt, and which way it breaks as the player
// looks at it. Design: plans/03-puttmaxx.md.
export const puttElevationEnum = pgEnum("putt_elevation", [
  "uphill",
  "downhill",
  "flat",
]);

export const puttBreakEnum = pgEnum("putt_break", ["l2r", "r2l", "straight"]);

// The two axes of the 3×3 miss grid. Each is independently nullable on a
// shot: a pure line miss had the right pace, and vice versa.
export const puttSpeedErrorEnum = pgEnum("putt_speed_error", ["fast", "slow"]);
export const puttLineErrorEnum = pgEnum("putt_line_error", ["left", "right"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// --- Profiles (1:1 with auth.users) ------------------------------------------
export const profiles = pgTable(
  "profiles",
  {
    // Equals auth.users.id — FK added in the companion SQL migration.
    id: uuid("id").primaryKey(),
    username: text("username"),
    // e.g. 12.4; interpolated for baselines between the 5-stroke brackets.
    handicap: numeric("handicap", { precision: 4, scale: 1 }),
    // 'imperial' (yd/ft) | 'metric' (m) — metric deferred.
    units: text("units").notNull().default("imperial"),
    // 'handicap' (use my interpolated handicap) | 'tour' | '0'|'5'|...|'25'
    defaultBaseline: text("default_baseline").notNull().default("handicap"),
    ...timestamps,
  },
  (t) => [
    // Case-insensitive uniqueness; blank/null usernames are excluded so
    // multiple users can leave it unset without colliding.
    uniqueIndex("profiles_username_lower_idx")
      .on(sql`lower(${t.username})`)
      .where(sql`${t.username} is not null and ${t.username} <> ''`),
  ],
);

// --- Rounds ------------------------------------------------------------------
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    // Client-generated id for offline-first idempotent sync.
    clientUuid: uuid("client_uuid").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    numHoles: integer("num_holes").notNull(),
    courseName: text("course_name"),
    // Handicap snapshot at play time (for reproducible baseline defaults).
    baselineSnapshot: numeric("baseline_snapshot", { precision: 4, scale: 1 }),
    status: roundStatusEnum("status").notNull().default("in_progress"),
    ...timestamps,
  },
  (t) => [
    unique("rounds_user_client_uuid_key").on(t.userId, t.clientUuid),
    check("rounds_num_holes_check", sql`${t.numHoles} in (9, 18)`),
    index("rounds_user_played_idx").on(t.userId, t.playedAt),
  ],
);

// --- Holes -------------------------------------------------------------------
export const holes = pgTable(
  "holes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("holes_round_hole_number_key").on(t.roundId, t.holeNumber),
    check("holes_hole_number_check", sql`${t.holeNumber} between 1 and 18`),
    check("holes_par_check", sql`${t.par} between 3 and 5`),
  ],
);

// --- Shots -------------------------------------------------------------------
export const shots = pgTable(
  "shots",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    holeId: uuid("hole_id")
      .notNull()
      .references(() => holes.id, { onDelete: "cascade" }),
    shotNumber: integer("shot_number").notNull(),

    // Start position (unit derived from lie: green=feet, else yards).
    startLie: lieEnum("start_lie").notNull(),
    startDistance: numeric("start_distance").notNull(),

    // End position — null when holed.
    endLie: lieEnum("end_lie"),
    endDistance: numeric("end_distance"),
    isHoled: boolean("is_holed").notNull().default(false),

    // Penalty model: 1 = penalty drop (end = drop spot);
    // 2 = OOB / stroke-and-distance (end = where the re-hit finished).
    penaltyStrokes: integer("penalty_strokes").notNull().default(0),
    isOb: boolean("is_ob").notNull().default(false),

    // Derived cache — recomputed on edit.
    sgCategory: sgCategoryEnum("sg_category"),
    sgValue: numeric("sg_value"),
    ...timestamps,
  },
  (t) => [
    unique("shots_hole_shot_number_key").on(t.holeId, t.shotNumber),
    check("shots_penalty_check", sql`${t.penaltyStrokes} between 0 and 2`),
    index("shots_hole_idx").on(t.holeId),
  ],
);

// --- Wedgemaxx sessions ------------------------------------------------------
// Wedge distance-control practice. Design + scoring: plans/02-wedgemaxx.md.
// Reuses roundStatusEnum: it's the identical in_progress/complete state
// machine, and a second enum type with the same two values would just be a
// duplicate source of truth.
export const wedgeSessions = pgTable(
  "wedge_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    // Client-generated id for offline-first idempotent sync.
    clientUuid: uuid("client_uuid").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Session parameters, chosen at setup.
    ballCount: integer("ball_count").notNull(),
    minDistance: integer("min_distance").notNull(),
    maxDistance: integer("max_distance").notNull(),
    // Active time only — the timer pauses when the user backs out.
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    // The full sequence of target yardages, rolled once at creation. Storing
    // them (rather than rolling per ball in the client) means a reload or a
    // force-quit hands back the SAME yardage instead of re-rolling it, and
    // the offline layer gets them for free. Stored rather than derived from a
    // seed so the numbers can't shift if the RNG ever changes. Defaults empty
    // so sessions created before this column fall back to rolling on the fly.
    targets: integer("targets")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    status: roundStatusEnum("status").notNull().default("in_progress"),
    ...timestamps,
  },
  (t) => [
    unique("wedge_sessions_user_client_uuid_key").on(t.userId, t.clientUuid),
    check(
      "wedge_sessions_ball_count_check",
      sql`${t.ballCount} between 1 and 200`,
    ),
    check(
      "wedge_sessions_distance_check",
      sql`${t.minDistance} > 0 and ${t.minDistance} <= ${t.maxDistance}`,
    ),
    check("wedge_sessions_elapsed_check", sql`${t.elapsedSeconds} >= 0`),
    index("wedge_sessions_user_started_idx").on(t.userId, t.startedAt),
  ],
);

// --- Wedgemaxx shots ---------------------------------------------------------
export const wedgeShots = pgTable(
  "wedge_shots",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => wedgeSessions.id, { onDelete: "cascade" }),
    shotNumber: integer("shot_number").notNull(),
    // The yardage the app called out, in whole yards.
    targetDistance: integer("target_distance").notNull(),
    // Carry actually hit. NULL *is* the mishit flag (shank/top/duff): there's
    // no meaningful carry to record, and keeping it as the single source of
    // truth means a shot can never be flagged a mishit while also carrying a
    // distance. Scored as zero progress — see lib/wedge/engine.ts.
    carryDistance: integer("carry_distance"),
    ...timestamps,
  },
  (t) => [
    unique("wedge_shots_session_shot_number_key").on(t.sessionId, t.shotNumber),
    check("wedge_shots_target_check", sql`${t.targetDistance} > 0`),
    check(
      "wedge_shots_carry_check",
      sql`${t.carryDistance} is null or ${t.carryDistance} >= 0`,
    ),
    index("wedge_shots_session_idx").on(t.sessionId),
  ],
);

// --- Puttmaxx sessions -------------------------------------------------------
// Practice-green putting. Design + analytics: plans/03-puttmaxx.md.
// Reuses roundStatusEnum — the identical in_progress/complete state machine.
export const puttSessions = pgTable(
  "putt_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    // Client-generated id for offline-first idempotent sync.
    clientUuid: uuid("client_uuid").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Session parameters, chosen at setup. Distances in FEET (green lie).
    puttCount: integer("putt_count").notNull(),
    minDistance: integer("min_distance").notNull(),
    maxDistance: integer("max_distance").notNull(),
    // Active time only — the timer pauses when the user backs out.
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    /**
     * The full sequence of called putts, rolled once at creation:
     *   [{ distanceFt, elevation, breakDirection }, …]
     *
     * Rolled up front for two reasons. A reload or force-quit must hand back
     * the SAME putt rather than re-rolling it, and the offline layer gets the
     * sequence for free. More importantly the sequence can only be *balanced*
     * — equal counts of each break direction — if it's dealt as a whole; drawn
     * per putt, a skewed session lets a read fault masquerade as a stroke bias.
     *
     * jsonb rather than three parallel arrays because the three fields travel
     * together and parallel arrays can drift out of sync.
     */
    putts: jsonb("putts")
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: roundStatusEnum("status").notNull().default("in_progress"),
    ...timestamps,
  },
  (t) => [
    unique("putt_sessions_user_client_uuid_key").on(t.userId, t.clientUuid),
    check("putt_sessions_count_check", sql`${t.puttCount} between 1 and 100`),
    check(
      "putt_sessions_distance_check",
      sql`${t.minDistance} > 0 and ${t.minDistance} <= ${t.maxDistance}`,
    ),
    check("putt_sessions_elapsed_check", sql`${t.elapsedSeconds} >= 0`),
    index("putt_sessions_user_started_idx").on(t.userId, t.startedAt),
  ],
);

// --- Puttmaxx attempts -------------------------------------------------------
// One row per hole: the called putt, how the first one finished, and — when it
// missed — the comeback. The comeback is captured on the same 3×3 grid rather
// than a yes/no, because it's a putt and therefore a data point.
export const puttAttempts = pgTable(
  "putt_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => puttSessions.id, { onDelete: "cascade" }),
    puttNumber: integer("putt_number").notNull(),

    // The putt the app called out.
    distance: integer("distance").notNull(),
    elevation: puttElevationEnum("elevation").notNull(),
    breakDirection: puttBreakEnum("break_direction").notNull(),

    // First putt. Invariant: made === (speed_error IS NULL AND line_error IS
    // NULL) — the grid's centre button *is* "Made!", so any other cell carries
    // at least one error.
    made: boolean("made").notNull(),
    speedError: puttSpeedErrorEnum("speed_error"),
    lineError: puttLineErrorEnum("line_error"),
    // Self-reported cause, as distinct from the measured outcome above.
    misreadLine: boolean("misread_line").notNull().default(false),
    misreadSpeed: boolean("misread_speed").notNull().default(false),

    // The comeback. All null when the first putt dropped.
    comebackDistance: integer("comeback_distance"),
    comebackMade: boolean("comeback_made"),
    comebackSpeedError: puttSpeedErrorEnum("comeback_speed_error"),
    comebackLineError: puttLineErrorEnum("comeback_line_error"),

    ...timestamps,
  },
  (t) => [
    unique("putt_attempts_session_putt_number_key").on(
      t.sessionId,
      t.puttNumber,
    ),
    check("putt_attempts_distance_check", sql`${t.distance} > 0`),
    check(
      "putt_attempts_comeback_distance_check",
      sql`${t.comebackDistance} is null or ${t.comebackDistance} >= 0`,
    ),
    // A made putt has no miss to describe, and a miss must have missed
    // somehow. Enforced here so the analytics can trust the invariant rather
    // than defending against contradictory rows.
    check(
      "putt_attempts_made_consistency_check",
      sql`(${t.made} and ${t.speedError} is null and ${t.lineError} is null)
          or (not ${t.made} and (${t.speedError} is not null or ${t.lineError} is not null))`,
    ),
    // A made putt has no comeback; a missed one must record where it left the
    // ball. The comeback's own outcome is filled in a moment later, so it is
    // deliberately NOT required here.
    check(
      "putt_attempts_comeback_presence_check",
      sql`(${t.made} and ${t.comebackDistance} is null and ${t.comebackMade} is null)
          or (not ${t.made})`,
    ),
    index("putt_attempts_session_idx").on(t.sessionId),
  ],
);

// --- Inferred types ----------------------------------------------------------
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type Hole = typeof holes.$inferSelect;
export type NewHole = typeof holes.$inferInsert;
export type Shot = typeof shots.$inferSelect;
export type NewShot = typeof shots.$inferInsert;
export type PuttSession = typeof puttSessions.$inferSelect;
export type NewPuttSession = typeof puttSessions.$inferInsert;
export type PuttAttemptRow = typeof puttAttempts.$inferSelect;
export type NewPuttAttemptRow = typeof puttAttempts.$inferInsert;
