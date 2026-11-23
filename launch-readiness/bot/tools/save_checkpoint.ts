import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

const CHECKPOINT_KEY = "launch-readiness:checkpoint";

export default defineTool({
  description: prompt`
    Persist durable launch-readiness checkpoint so the next session can resume
    without recreating fixtures or losing cycle progress.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    cycle: z.number().int().min(0),
    cleanCycles: z.number().int().min(0).max(3),
    phase: z.string().min(2).max(120),
    nextAction: z.string().min(2).max(2000),
    blockers: z.array(z.string()).default([]),
    notes: z.string().max(8000).default(""),
    simulationPrefix: z.string().default("QA-LAUNCH-2026"),
    environment: z
      .enum(["dry-run", "isolated", "production-authorised"])
      .default("dry-run"),
  }),
  async execute(input, ctx) {
    const checkpoint = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(CHECKPOINT_KEY, checkpoint);
    await ctx.host.files.write(
      "checkpoint.json",
      JSON.stringify(checkpoint, null, 2),
    );

    try {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const md = `# Launch readiness checkpoint

Updated: ${checkpoint.updatedAt} (UTC)

| Field | Value |
| --- | --- |
| Cycle | ${checkpoint.cycle} |
| Clean cycles | ${checkpoint.cleanCycles} / 3 |
| Phase | ${checkpoint.phase} |
| Environment | ${checkpoint.environment} |
| Simulation prefix | ${checkpoint.simulationPrefix} |

## Next action

${checkpoint.nextAction}

## Blockers

${checkpoint.blockers.length ? checkpoint.blockers.map((b) => `- ${b}`).join("\n") : "- None recorded"}

## Notes

${checkpoint.notes || "_None_"}
`;
      const target = resolve(process.cwd(), "..", "docs/launch-readiness/CHECKPOINT.md");
      await mkdir(resolve(process.cwd(), "..", "docs/launch-readiness"), {
        recursive: true,
      });
      await writeFile(target, md, "utf8");
    } catch {
      // Hosted runtimes may not mount the sibling tree.
    }

    return { ok: true, checkpoint };
  },
});
