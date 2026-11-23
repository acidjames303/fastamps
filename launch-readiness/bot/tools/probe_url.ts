import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

/** Canonical production FastAmps Connect Base44 app — do not probe other apps as Connect. */
export const CONNECT_APP_ID = "6adf6de7ebdb4cb382e8779f";

const ALLOWED_HOSTS = new Set([
  "connect.fastamps.com",
  "connect-test.fastamps.com",
  "fastamps-connect-v1.base44.app",
  "fastamps-connect.base44.app",
]);

export default defineTool({
  description: prompt`
    Read-only HTTP probe of FastAmps Connect (Base44 app ${CONNECT_APP_ID}).
    Returns status, redirect target, content-type, Connect shell match, and whether
    the response references the expected app id. Only allowed Connect hosts.
  `,
  effect: "read",
  inputSchema: z.object({
    url: z.string().url(),
  }),
  async execute({ url }) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "Invalid URL." };
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return {
        ok: false,
        error: `Host not allowed for probing: ${parsed.hostname}`,
      };
    }

    const started = Date.now();
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/html,application/json,*/*" },
    });
    const location = response.headers.get("location");
    const contentType = response.headers.get("content-type") || "";
    let bodySnippet = "";
    let looksLikeConnect = false;
    let hasTargetAppId = false;
    let text = "";
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      text = await response.text();
      bodySnippet = text.slice(0, 400);
      looksLikeConnect =
        /FastAmps Connect/i.test(text) ||
        /fastamps/i.test(text) ||
        /manifest\.json/i.test(text);
      hasTargetAppId = text.includes(CONNECT_APP_ID);
    }

    let loginInfo: { id?: string; name?: string; slug?: string } | null = null;
    if (parsed.hostname === "connect.fastamps.com") {
      try {
        const infoRes = await fetch(
          `https://connect.fastamps.com/api/apps/public/login-info/by-id/${CONNECT_APP_ID}`,
          { headers: { Accept: "application/json" } },
        );
        if ((infoRes.headers.get("content-type") || "").includes("application/json")) {
          const info = (await infoRes.json()) as {
            id?: string;
            name?: string;
            slug?: string;
          };
          loginInfo = { id: info.id, name: info.name, slug: info.slug };
        }
      } catch {
        loginInfo = null;
      }
    }

    const appIdMatch = loginInfo?.id === CONNECT_APP_ID || hasTargetAppId;

    return {
      ok: response.status >= 200 && response.status < 400 && appIdMatch,
      url: parsed.toString(),
      status: response.status,
      redirectedTo: location,
      contentType,
      elapsedMs: Date.now() - started,
      looksLikeConnect,
      expectedAppId: CONNECT_APP_ID,
      hasTargetAppId,
      loginInfo,
      appIdMatch,
      bodySnippet,
    };
  },
});
