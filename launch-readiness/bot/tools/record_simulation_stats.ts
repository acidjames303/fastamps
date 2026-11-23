import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

const STATS_KEY = "launch-readiness:simulation-stats";

export default defineTool({
  description: prompt`
    Record measured simulation statistics (installers, installs, photos,
    concurrency, rewards, Giftbit boundary). Prefer actual counts over estimates.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    installersCreated: z.number().int().min(0).optional(),
    installsCompleted: z.number().int().min(0).optional(),
    installsVerifiedInBackend: z.number().int().min(0).optional(),
    photosAssociated: z.number().int().min(0).optional(),
    peakConcurrentUsers: z.number().int().min(0).optional(),
    rewardJourneysCompleted: z.number().int().min(0).optional(),
    giftbitStatus: z
      .enum([
        "not_tested",
        "testbed_only",
        "readiness_check_only",
        "non_fulfilment_boundary",
        "production_verified",
        "blocked",
      ])
      .optional(),
    issuesFound: z.number().int().min(0).optional(),
    issuesFixed: z.number().int().min(0).optional(),
    openP0: z.number().int().min(0).optional(),
    openP1: z.number().int().min(0).optional(),
    openP2: z.number().int().min(0).optional(),
    openP3: z.number().int().min(0).optional(),
    cleanCycles: z.number().int().min(0).max(3).optional(),
    featureFreezeCompliant: z.boolean().optional(),
    notes: z.string().max(4000).optional(),
  }),
  async execute(input, ctx) {
    const previous =
      ((await ctx.host.kv.get(STATS_KEY)) as Record<string, unknown> | null) ||
      {};
    const stats = {
      ...previous,
      ...Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ),
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(STATS_KEY, stats);
    return { ok: true, stats };
  },
});
