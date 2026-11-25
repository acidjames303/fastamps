# Cadence — real target + UX amplification

**Updated:** 24 Nov 2026 (Europe/London)  
**Owner feedback:** “I like where it is heading but it can be even more intuitive and powerful.”

---

## 1. Correct product target (Verified)

| Field | Value |
|---|---|
| Live URL | https://evasive-dial-flow-go.base44.app |
| Base44 app id | `6a7338f6106b1962aa31c00a` |
| Manifest name | **Cadence — Sales Calling Workspace** |
| Meta description | Intelligent sales workspace: AI lead briefings, bulk data clustering, multi-platform campaign management |
| Auth | Hard login wall (`/` → `/login`) |
| Public surface | Login / signup / forgot-password only (screenshots in `evidence/real-target/`) |

**Not the target:** https://cadence.base44.app (CommDecide meeting/email/async tool). Different product.

**Access still blocked for authenticated UX:** agent Base44 token is Connect-scoped; cannot open app `6a7338…` via API. Deep page/entity inventory requires Cadence-workspace token + QA login.

---

## 2. Direction check

The master brief is the right north star:

> Powerful underneath. Effortless on the surface.

Owner feedback asks us to push **both** sides further — not trade one for the other.

---

## 3. Amplification principles (Proposed)

These are design constraints for every sprint. If a feature fails a principle, redesign it before shipping.

### More intuitive

1. **One next action** — Every screen answers “what should I do now?” with a single primary CTA. Secondary actions are quiet.
2. **Campaign chip always visible** — Workspace + campaign stay in chrome. Changing section never drops context.
3. **Role chrome, not role menus** — Callers never see admin. JP’s admin is a separate mode, not mixed into My Day.
4. **Speak or click, same result** — Natural language opens the same screens/functions as the UI. No second mental model.
5. **Short words, large type** — Dyslexia-first: fewer labels, clearer verbs (Call, Research, Send draft), avoid walls of instruction.
6. **Save without asking** — Progress autosaves; show a calm “Saved” state. Never punish navigation.
7. **Empty states that start work** — No dead ends; empty = one action (“Import list”, “Continue calling”, “Build campaign”).

### More powerful

1. **Intelligence executes** — Cadence Intelligence navigates and runs authorised functions; it is not a chatbot homepage.
2. **Campaign brain is the product core** — Brief, ICP, research, scripts, outcomes, preferences persist and feed calling + outreach automatically.
3. **Credit-smart prospecting** — Prefer known data → public → infer → paid enrich. Never rebuy what the workspace already holds.
4. **Focused call mode** — Full company/contact/history/script/outcome/dictation in one surface; leave without losing place.
5. **Draft ≠ send** — AI can draft freely; external send and paid actions always need explicit approval.
6. **Ambiguity queues** — Duplicate companies / weak emails go to review — never invent “verified” facts.
7. **External AI is optional** — Cursor/ChatGPT via App MCP for JP; Aileen/Malcolm/callers succeed entirely inside Cadence.

---

## 4. Intuitive × powerful interaction model

```
My Day (role-adaptive)
   │
   ├─ Ask Cadence (⌘K / voice) ──► resolve intent ──► existing screen OR function
   │
   └─ Manual nav (Campaigns · Prospecting · Calling · Outreach · Inbox · Team)
         └─ persistent campaign context + campaign brain
```

**Power without complexity:** advanced tools (enrichment providers, bulk ops, admin, integrations) live one progressive-disclosure step behind the calm primary path.

---

## 5. What “even more” means for each person

| Person | More intuitive | More powerful |
|---|---|---|
| **JP** | Work mode vs Admin mode; workspace switch in one click | Campaign brain + Intelligence that continues yesterday’s work |
| **Aileen** | “Who needs me?” homepage (approvals, leads, callers) | One-tap into Colleen’s day; Outlook draft→approve→send |
| **Malcolm** | Upload → talk → confirm brief (no forms maze) | 3k LinkedIn CSV → research → ambiguous queue → outreach drafts |
| **Caller** | Login → Continue calling (≤3 interactions) | Full call cockpit; dictation that understands “call” not “cool” |

---

## 6. Anti-patterns to reject (even if “powerful”)

- Another dashboard full of cards and stats in the first viewport  
- A forced chatbot as the only way to work  
- Rebuilding outreach while other agents own it  
- Feature expansion before navigation/context/save reliability  
- Purple “AI product” chrome that increases cognitive load  

---

## 7. Immediate next steps

1. **Authenticated audit** of evasive-dial-flow-go (pages, nav, entities, friction) — needs Cadence API token + QA login.  
2. **Baseline metrics** on the real UI (clicks to call, find spreadsheet, create campaign).  
3. **Sprint 1** only after baseline: simplify IA + My Day + campaign chip — no new major features yet.  
4. Then Intelligence command bar on top of existing functions.

---

*Amplification only. No production changes in this document.*
