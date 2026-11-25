// One reading of a prospect's TPS/CTPS verdict for the UI.
//
// A "safe" verdict only means anything while the provider's validity window
// holds and while it covers the numbers actually on the record. An expired
// check, or one whose numbers have since changed, is never shown as safe to call.

export function normaliseUkNumber(raw) {
  if (!raw) return "";
  let d = String(raw).replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.startsWith("0044")) d = d.slice(4);
  else if (d.startsWith("44") && d.length > 10) d = d.slice(2);
  if (!d.startsWith("0")) d = "0" + d;
  d = d.replace(/\D/g, "");
  return d.length >= 9 && d.length <= 11 ? d : "";
}

function currentNumbers(prospect) {
  const set = new Set();
  const add = (raw) => {
    const n = normaliseUkNumber(raw);
    if (n) set.add(n);
  };
  add(prospect?.mobile);
  add(prospect?.direct_dial);
  add(prospect?.company_phone);
  add(prospect?.phone);
  add(prospect?.landline);
  for (const c of Array.isArray(prospect?.contacts) ? prospect.contacts : []) {
    add(c?.mobile);
    add(c?.direct_dial);
    add(c?.phone);
  }
  return set;
}

export function screeningState(prospect) {
  const status = prospect?.tps_ctps_status;
  if (status === "listed") return "listed";
  if (status === "safe") {
    const until = prospect?.tps_ctps_valid_until;
    if (until) {
      const t = new Date(until).getTime();
      if (Number.isFinite(t) && t <= Date.now()) return "expired";
    }
    const screened = new Set(
      (prospect?.tps_ctps_results || []).map((d) => normaliseUkNumber(d?.number)).filter(Boolean),
    );
    const live = currentNumbers(prospect);
    for (const n of live) {
      if (!screened.has(n)) return "changed";
    }
    return "safe";
  }
  if (status === "unavailable") return "unavailable";
  return "unchecked";
}

export function screeningDetail(prospect) {
  return (prospect?.tps_ctps_results || [])
    .map((d) => `${d.role || "Number"} ${d.number}: ${d.result}`)
    .join("\n");
}