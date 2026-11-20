import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

type Issue = {
  id: string;
  description: string;
  severity: string;
  workflow: string;
  preventsPilotLaunch: boolean;
  actionTaken: string;
  verificationEvidence: string;
  outstandingDependencies: string;
  status: string;
  updatedAt: string;
};

type Health = Record<string, string>;

const ISSUES_KEY = "launch-readiness:issues";
const HEALTH_KEY = "launch-readiness:health";
const REPORT_PATH = "docs/launch-readiness/LAUNCH_READINESS_REPORT.md";

function cell(value: unknown) {
  return String(value ?? "—");
}

export default defineTool({
  description: prompt`
    Write or refresh the central FastAmps Connect Launch Readiness Report
    at docs/launch-readiness/LAUNCH_READINESS_REPORT.md using recorded issues and health.
    Also stores a durable copy in host files.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    executiveSummary: z.string().min(20).max(4000),
    evidenceNotes: z.string().max(8000).default(""),
  }),
  async execute({ executiveSummary, evidenceNotes }, ctx) {
    const issues = ((await ctx.host.kv.get(ISSUES_KEY)) as Issue[] | null) || [];
    const health = ((await ctx.host.kv.get(HEALTH_KEY)) as Health | null) || {};
    const generatedAt = new Date().toISOString();

    const issueRows = issues.length
      ? issues
          .map(
            (issue) =>
              `| ${issue.id} | ${issue.severity} | ${issue.status} | ${issue.workflow} | ${issue.preventsPilotLaunch ? "Yes" : "No"} | ${issue.description.replace(/\|/g, "/")} | ${issue.actionTaken.replace(/\|/g, "/") || "—"} | ${issue.verificationEvidence.replace(/\|/g, "/") || "—"} | ${issue.outstandingDependencies.replace(/\|/g, "/") || "—"} |`,
          )
          .join("\n")
      : "| — | — | — | — | — | No issues recorded yet | — | — | — |";

    const markdown = `# FastAmps Connect — Launch Readiness Report

Generated: ${generatedAt} (UTC)  
Application: https://connect.fastamps.com  
Pilot window: 23–24 November 2026  
Agent: launch-readiness

## Executive summary

${executiveSummary}

## Application health

| Area | Status |
| --- | --- |
| Installer journey | ${cell(health.installerJourney)} |
| Admin journey | ${cell(health.adminJourney)} |
| Code registration | ${cell(health.codeRegistration)} |
| Photo uploads | ${cell(health.photoUploads)} |
| Incentive and wallet | ${cell(health.incentiveWallet)} |
| Giftbit integration | ${cell(health.giftbitIntegration)} |
| Security and permissions | ${cell(health.securityPermissions)} |
| Mobile usability | ${cell(health.mobileUsability)} |
| Google Play readiness | ${cell(health.googlePlayReadiness)} |
| Apple App Store readiness | ${cell(health.appleAppStoreReadiness)} |

## Launch decisions

| Track | Decision |
| --- | --- |
| Controlled wholesaler pilot | **${cell(health.pilotDecision)}** |
| Android / Google Play submission | **${cell(health.androidStoreDecision)}** |
| iOS / Apple App Store submission | **${cell(health.iosStoreDecision)}** |

Notes: ${cell(health.notes)}

## Issues

| ID | Severity | Status | Workflow | Blocks pilot | Description | Action taken | Verification | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${issueRows}

## Evidence notes

${evidenceNotes || "_No additional evidence notes._"}

## Operating reminder

Do not confuse mobile-web pilot readiness with native store approval. Do not issue live Giftbit rewards or alter incentive rules without FastAmps approval.
`;

    await ctx.host.files.write("launch-readiness-report.md", markdown);

    // Best-effort mirror into the Connect workspace when this agent runs beside the app.
    try {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname, resolve } = await import("node:path");
      const target = resolve(process.cwd(), "..", REPORT_PATH);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, markdown, "utf8");
    } catch {
      // Hosted runtimes may not mount the sibling app tree; kv/files still hold the report.
    }

    return {
      ok: true,
      path: REPORT_PATH,
      hostFile: "launch-readiness-report.md",
      issueCount: issues.length,
      generatedAt,
    };
  },
});
