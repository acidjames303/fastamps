import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

type Health = {
  installerJourney: "Pass" | "Fail" | "Blocked";
  adminJourney: "Pass" | "Fail" | "Blocked";
  codeRegistration: "Pass" | "Fail" | "Blocked";
  photoUploads: "Pass" | "Fail" | "Blocked";
  incentiveWallet: "Pass" | "Fail" | "Blocked";
  giftbitIntegration: "Pass" | "Fail" | "Blocked";
  securityPermissions: "Pass" | "Fail" | "Blocked";
  mobileUsability: "Pass" | "Fail" | "Blocked";
  googlePlayReadiness: "Ready" | "Blocked" | "Pending Review";
  appleAppStoreReadiness: "Ready" | "Blocked" | "Pending Review";
  pilotDecision: "GO" | "CONDITIONAL GO" | "NO-GO";
  androidStoreDecision: "GO" | "CONDITIONAL GO" | "NO-GO";
  iosStoreDecision: "GO" | "CONDITIONAL GO" | "NO-GO";
  notes: string;
  updatedAt: string;
};

const HEALTH_KEY = "launch-readiness:health";

export default defineTool({
  description: prompt`
    Update the FastAmps Connect launch health scorecard and decisions.
    Store readiness must not be confused with store approval.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    installerJourney: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    adminJourney: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    codeRegistration: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    photoUploads: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    incentiveWallet: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    giftbitIntegration: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    securityPermissions: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    mobileUsability: z.enum(["Pass", "Fail", "Blocked"]).optional(),
    googlePlayReadiness: z
      .enum(["Ready", "Blocked", "Pending Review"])
      .optional(),
    appleAppStoreReadiness: z
      .enum(["Ready", "Blocked", "Pending Review"])
      .optional(),
    pilotDecision: z.enum(["GO", "CONDITIONAL GO", "NO-GO"]).optional(),
    androidStoreDecision: z.enum(["GO", "CONDITIONAL GO", "NO-GO"]).optional(),
    iosStoreDecision: z.enum(["GO", "CONDITIONAL GO", "NO-GO"]).optional(),
    notes: z.string().max(4000).optional(),
  }),
  async execute(input, ctx) {
    const previous =
      ((await ctx.host.kv.get(HEALTH_KEY)) as Health | null) ||
      ({
        installerJourney: "Blocked",
        adminJourney: "Blocked",
        codeRegistration: "Blocked",
        photoUploads: "Blocked",
        incentiveWallet: "Blocked",
        giftbitIntegration: "Blocked",
        securityPermissions: "Blocked",
        mobileUsability: "Blocked",
        googlePlayReadiness: "Blocked",
        appleAppStoreReadiness: "Blocked",
        pilotDecision: "NO-GO",
        androidStoreDecision: "NO-GO",
        iosStoreDecision: "NO-GO",
        notes: "",
        updatedAt: new Date(0).toISOString(),
      } satisfies Health);

    const health: Health = {
      ...previous,
      ...Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(HEALTH_KEY, health);
    return { ok: true, health };
  },
});
