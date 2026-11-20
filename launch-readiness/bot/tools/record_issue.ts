import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

type Issue = {
  id: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  workflow: string;
  preventsPilotLaunch: boolean;
  actionTaken: string;
  verificationEvidence: string;
  outstandingDependencies: string;
  status: "open" | "fixed" | "verified" | "wont_fix" | "blocked";
  updatedAt: string;
};

const ISSUES_KEY = "launch-readiness:issues";

export default defineTool({
  description: prompt`
    Record or update a FastAmps Connect launch-readiness issue.
    Use for every defect, risk, or verification gap.
    Never mark status verified without verificationEvidence.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    id: z
      .string()
      .min(3)
      .max(80)
      .describe("Stable issue id, e.g. QR-TRADESHOW-001"),
    description: z.string().min(8).max(2000),
    severity: z.enum(["Critical", "High", "Medium", "Low"]),
    workflow: z
      .string()
      .min(2)
      .max(120)
      .describe("Affected journey, e.g. installer claim, admin import"),
    preventsPilotLaunch: z.boolean(),
    actionTaken: z.string().max(2000).default(""),
    verificationEvidence: z.string().max(4000).default(""),
    outstandingDependencies: z.string().max(2000).default(""),
    status: z
      .enum(["open", "fixed", "verified", "wont_fix", "blocked"])
      .default("open"),
  }),
  async execute(input, ctx) {
    if (input.status === "verified" && !input.verificationEvidence.trim()) {
      return {
        ok: false,
        error: "Cannot mark verified without verificationEvidence.",
      };
    }

    const existing = ((await ctx.host.kv.get(ISSUES_KEY)) as Issue[] | null) || [];
    const next: Issue = {
      id: input.id,
      description: input.description,
      severity: input.severity,
      workflow: input.workflow,
      preventsPilotLaunch: input.preventsPilotLaunch,
      actionTaken: input.actionTaken,
      verificationEvidence: input.verificationEvidence,
      outstandingDependencies: input.outstandingDependencies,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    const idx = existing.findIndex((item) => item.id === next.id);
    const issues = [...existing];
    if (idx >= 0) issues[idx] = next;
    else issues.push(next);
    await ctx.host.kv.put(ISSUES_KEY, issues);

    const openBlockers = issues.filter(
      (item) =>
        item.status !== "verified" &&
        item.status !== "wont_fix" &&
        item.preventsPilotLaunch,
    ).length;

    return {
      ok: true,
      issue: next,
      totalIssues: issues.length,
      openPilotBlockers: openBlockers,
    };
  },
});
