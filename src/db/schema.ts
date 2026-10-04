import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Real accounts only. No demo/seed rows are ever inserted by this app.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    locale: text("locale").notNull().default("ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/** Monthly budget + currency chosen right after sign-in/sign-up. */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("SYP_NEW"),
    /** Day of month the budget cycle starts on (1..28). */
    cycleStartDay: integer("cycle_start_day").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budgets_user_unique").on(t.userId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Civil date as yyyy-mm-dd, never parsed as UTC. */
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("SYP_NEW"),
    kind: text("kind").notNull().default("expense"), // expense | income
    category: text("category").notNull().default("other"),
    note: text("note"),
    source: text("source").notNull().default("manual"), // voice | manual
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.occurredOn),
    index("transactions_user_category_idx").on(t.userId, t.category),
  ],
);

/** Voice inbox: the raw recording + transcript so the user can re-listen later. */
export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transcript: text("transcript").notNull(),
    audioBase64: text("audio_base64"),
    mimeType: text("mime_type"),
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("pending"), // pending | saved | archived
    parsedAmount: numeric("parsed_amount", { precision: 16, scale: 2 }),
    parsedCurrency: text("parsed_currency"),
    parsedCategory: text("parsed_category"),
    parsedNote: text("parsed_note"),
    parsedDate: date("parsed_date", { mode: "string" }),
    parsedKind: text("parsed_kind"),
    transactionId: uuid("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recordings_user_status_idx").on(t.userId, t.status)],
);

export const userPrefs = pgTable(
  "user_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    locale: text("locale").notNull().default("ar"),
    /** "كتم إعادة الصوت بعد تسجيله" — never echo the user's own voice back. */
    muteReplay: boolean("mute_replay").notNull().default(true),
    speakConfirmations: boolean("speak_confirmations").notNull().default(false),
    voiceUri: text("voice_uri"),
    speechRate: real("speech_rate").notNull().default(1),
    speechPitch: real("speech_pitch").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type UserPrefs = typeof userPrefs.$inferSelect;
