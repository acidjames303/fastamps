import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

const CHECKPOINT_KEY = "launch-readiness:checkpoint";

export default defineTool({
  description: prompt`
    Load the latest launch-readiness checkpoint (kv, then host file fallback).
    Call this at the start of every session before planning work.
  `,
  effect: "read",
  inputSchema: z.object({}).optional(),
  async execute(_input, ctx) {
    const fromKv = (await ctx.host.kv.get(CHECKPOINT_KEY)) as Record<
      string,
      unknown
    > | null;
    if (fromKv) return { ok: true, source: "kv", checkpoint: fromKv };

    try {
      const raw = await ctx.host.files.read("checkpoint.json");
      const checkpoint = JSON.parse(String(raw));
      return { ok: true, source: "host.files", checkpoint };
    } catch {
      return {
        ok: true,
        source: "none",
        checkpoint: {
          cycle: 0,
          cleanCycles: 0,
          phase: "inspect",
          nextAction:
            "Audit live app, confirm publish state, then plan Cycle 1 smoke (not full 400 until authorised).",
          blockers: [],
          environment: "dry-run",
          simulationPrefix: "QA-LAUNCH-2026",
        },
      };
    }
  },
});
