import { tool } from "@opencode-ai/plugin";
import { $ } from "bun";

interface SuiteResult {
  ok: boolean;
  output: string;
}

export const noctowl_test = tool({
  description:
    "Run NoctOwl test suite. Args: suite (api|web|ai|mobile|all), e2e (boolean).",
  args: {
    suite: tool.schema.enum(["api", "web", "ai", "mobile", "all"]),
    e2e: tool.schema.boolean().optional().default(false),
  },
  async execute(args, context) {
    const results: Record<string, SuiteResult> = {};
    const root = context.directory;

    const run = async (cmd: string, cwd: string): Promise<SuiteResult> => {
      try {
        const out = await $`sh -c ${cmd}`.cwd(cwd).text();
        return { ok: true, output: out.slice(-2000) };
      } catch (error: unknown) {
        const err = error as { stderr?: Buffer; message?: string };
        return {
          ok: false,
          output: err.stderr?.toString().slice(-2000) || err.message || "Command failed",
        };
      }
    };

    if (args.suite === "api" || args.suite === "all") {
      results.api = await run("npm test", `${root}/apps/api`);
      if (args.e2e) {
        results.api_e2e = await run(
          "USE_REAL_REDIS=true npm run test:e2e",
          `${root}/apps/api`,
        );
      }
    }

    if (args.suite === "web" || args.suite === "all") {
      results.web = await run("npm test", `${root}/apps/web`);
    }

    if (args.suite === "ai" || args.suite === "all") {
      results.ai = await run(
        "if [ -x .venv/bin/pytest ]; then .venv/bin/pytest; else pytest; fi",
        `${root}/apps/ai-service`,
      );
    }

    if (args.suite === "mobile" || args.suite === "all") {
      results.mobile = await run("npm test", `${root}/apps/mobile`);
    }

    return JSON.stringify(results, null, 2);
  },
});
