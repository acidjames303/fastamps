import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";

const ALLOWED_HOSTS = new Set([
  "connect.fastamps.com",
  "connect-test.fastamps.com",
  "fastamps-connect-v1.base44.app",
  "fastamps-connect.base44.app",
]);

export default defineTool({
  description: prompt`
    Read-only HTTP probe of a FastAmps Connect URL.
    Returns status, redirect target, content-type, and whether the body looks like the Connect app shell.
    Only allowed hosts: connect.fastamps.com, connect-test.fastamps.com, and known Base44 app hosts.
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
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      const text = await response.text();
      bodySnippet = text.slice(0, 400);
      looksLikeConnect =
        /FastAmps Connect/i.test(text) ||
        /fastamps/i.test(text) ||
        /manifest\.json/i.test(text);
    }

    return {
      ok: response.status >= 200 && response.status < 400,
      url: parsed.toString(),
      status: response.status,
      redirectedTo: location,
      contentType,
      elapsedMs: Date.now() - started,
      looksLikeConnect,
      bodySnippet,
    };
  },
});
