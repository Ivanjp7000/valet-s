import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addScheduleColumns() {
  console.log("Adding scheduled_retrieval_at and reminder_email columns...");
  try {
    await db.execute(sql`
      ALTER TABLE valet_tickets
        ADD COLUMN IF NOT EXISTS scheduled_retrieval_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reminder_email VARCHAR;
    `);
    console.log("Done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

addScheduleColumns();
