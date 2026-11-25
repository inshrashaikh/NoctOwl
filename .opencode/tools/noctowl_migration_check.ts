import { tool } from "@opencode-ai/plugin";
import { $ } from "bun";

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /DROP\s+TABLE/i, label: "DROP TABLE" },
  { pattern: /DROP\s+COLUMN/i, label: "DROP COLUMN" },
  { pattern: /ALTER\s+COLUMN.*TYPE/i, label: "ALTER COLUMN ... TYPE" },
  { pattern: /TRUNCATE/i, label: "TRUNCATE" },
];

export const noctowl_migration_check = tool({
  description:
    "Check pending Prisma migrations for destructive operations before applying.",
  args: {},
  async execute(_args, context) {
    const apiDir = `${context.directory}/apps/api`;
    try {
      const status = await $`npx prisma migrate status`.cwd(apiDir).nothrow().text();
      const latestSql =
        await $`sh -c 'ls -t prisma/migrations/*/migration.sql 2>/dev/null | head -1 | xargs -r cat'`
          .cwd(apiDir)
          .text();

      const warnings = DESTRUCTIVE_PATTERNS.filter(({ pattern }) =>
        pattern.test(latestSql),
      ).map(({ label }) => `Potential destructive SQL detected: ${label}`);

      return JSON.stringify(
        {
          status: status.slice(-1000),
          destructiveWarnings: warnings.length > 0 ? warnings : "None detected",
          sqlPreview: latestSql.slice(-1500),
        },
        null,
        2,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Migration check failed";
      return JSON.stringify({ error: message }, null, 2);
    }
  },
});
