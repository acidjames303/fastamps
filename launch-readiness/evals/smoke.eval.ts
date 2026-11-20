import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Probes the live FastAmps Connect homepage with probe_url.",
  async test(t) {
    await t.send(
      'Use the probe_url tool on https://connect.fastamps.com and briefly say whether the site responded.',
    );
    t.succeeded();
    t.calledTool("probe_url");
  },
});
