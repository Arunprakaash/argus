// One-off migration runner. Usage:
//   DATABASE_URL="postgresql://..." node scripts/apply-migrations.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, "..", "supabase", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

// Only auto-apply files that don't contain placeholders.
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    if (sql.includes("<PROJECT_REF>") || sql.includes("<SERVICE_ROLE_KEY>")) {
      console.log(`SKIP ${f} (contains placeholders — apply manually after deploy)`);
      continue;
    }
    process.stdout.write(`APPLY ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("\nDone.");
} catch (err) {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
