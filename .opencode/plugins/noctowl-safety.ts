import type { Plugin } from "@opencode-ai/plugin";

const SECRET_PATTERNS = [
  /password\s*=\s*["']?[^"'\s]{8,}/i,
  /secret\s*=\s*["']?[^"'\s]{8,}/i,
];

function isPlaceholderValue(content: string): boolean {
  return (
    content.includes("changeme") ||
    content.includes("your-") ||
    content.includes("replace-with-") ||
    content.includes("<")
  );
}

export const NoctOwlSafetyPlugin: Plugin = async ({ $, directory }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "write" || input.tool === "edit") {
        const args = output.args as
          | {
              filePath?: string;
              path?: string;
              content?: string;
              newString?: string;
            }
          | undefined;
        const filePath = String(args?.filePath || args?.path || "");

        if (
          filePath.includes("/prisma/migrations/") &&
          filePath.endsWith("migration.sql")
        ) {
          const migrations = await $`ls prisma/migrations/`
            .cwd(`${directory}/apps/api`)
            .nothrow()
            .text();
          const count = migrations.split("\n").filter(Boolean).length;
          if (count > 1) {
            throw new Error(
              `SAFETY: Editing applied Prisma migration files is forbidden. ` +
                `Create a NEW migration instead. File: ${filePath}`,
            );
          }
        }

        if (filePath.endsWith(".env") && !filePath.endsWith(".env.example")) {
          const content = String(args?.content || args?.newString || "");
          if (
            SECRET_PATTERNS.some((pattern) => pattern.test(content)) &&
            !isPlaceholderValue(content)
          ) {
            throw new Error(
              "SAFETY: Writing real secrets to .env is blocked. Use .env.example with placeholders.",
            );
          }
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const cmd = String(
        (input as { args?: { command?: string } }).args?.command ||
          (output as { args?: { command?: string } }).args?.command ||
          "",
      );
      if (
        input.tool === "bash" &&
        cmd.includes("test:e2e") &&
        cmd.includes("notifications")
      ) {
        console.log(
          "[NoctOwl] Emergency notification E2E test executed. Verify delivery status in report.",
        );
      }
    },
  };
};
