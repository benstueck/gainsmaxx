CREATE TYPE "public"."lie" AS ENUM('tee', 'fairway', 'rough', 'sand', 'recovery', 'green');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."sg_category" AS ENUM('ott', 'app', 'arg', 'putt');--> statement-breakpoint
CREATE TABLE "holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holes_round_hole_number_key" UNIQUE("round_id","hole_number"),
	CONSTRAINT "holes_hole_number_check" CHECK ("holes"."hole_number" between 1 and 18),
	CONSTRAINT "holes_par_check" CHECK ("holes"."par" between 3 and 5)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"handicap" numeric(4, 1),
	"units" text DEFAULT 'imperial' NOT NULL,
	"default_baseline" text DEFAULT 'handicap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_uuid" uuid NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"num_holes" integer NOT NULL,
	"course_name" text,
	"baseline_snapshot" numeric(4, 1),
	"status" "round_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_user_client_uuid_key" UNIQUE("user_id","client_uuid"),
	CONSTRAINT "rounds_num_holes_check" CHECK ("rounds"."num_holes" in (9, 18))
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hole_id" uuid NOT NULL,
	"shot_number" integer NOT NULL,
	"start_lie" "lie" NOT NULL,
	"start_distance" numeric NOT NULL,
	"end_lie" "lie",
	"end_distance" numeric,
	"is_holed" boolean DEFAULT false NOT NULL,
	"penalty_strokes" integer DEFAULT 0 NOT NULL,
	"is_ob" boolean DEFAULT false NOT NULL,
	"sg_category" "sg_category",
	"sg_value" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shots_hole_shot_number_key" UNIQUE("hole_id","shot_number"),
	CONSTRAINT "shots_penalty_check" CHECK ("shots"."penalty_strokes" between 0 and 2)
);
--> statement-breakpoint
ALTER TABLE "holes" ADD CONSTRAINT "holes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_hole_id_holes_id_fk" FOREIGN KEY ("hole_id") REFERENCES "public"."holes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_user_played_idx" ON "rounds" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "shots_hole_idx" ON "shots" USING btree ("hole_id");