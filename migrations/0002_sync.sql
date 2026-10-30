-- Projects synced between a user's devices. updated_at is when the project was
-- last edited (on the device that edited it), synced_at when the server got it
create table "project" (
  "user_id" text not null references "user" ("id") on delete cascade,
  "id" text not null,
  "updated_at" integer not null,
  -- deleted projects are kept so other devices delete them too
  "deleted" integer not null default 0,
  -- JSON: title, text, doc, readings, pickedReadings
  "data" text,
  "synced_at" integer not null,
  primary key ("user_id", "id")
);

create index "project_user_synced_idx" on "project" ("user_id", "synced_at");

-- App settings shared by a user's devices (JSON)
create table "settings" (
  "user_id" text not null primary key references "user" ("id") on delete cascade,
  "updated_at" integer not null,
  "data" text not null
);
