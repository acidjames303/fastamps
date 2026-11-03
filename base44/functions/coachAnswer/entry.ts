import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ----- Knowledge base, split into retrievable sections -----
// Each section has keywords used to decide whether to include it for a given question.
// A small CORE is always included; the rest are attached only when the question matches.

const CORE = `You are the FastAmps Connect AI Coach — an expert assistant for FastAmps installers.
Be concise, practical, and helpful. Use UK English (£ pricing, VAT noted). Address the installer as a fellow professional.
When pricing comes up, remind them installers get 25% off the Alpha7 (from £299.25 + VAT).`;

const SECTIONS = [
  {
    name: 'business',
    keywords: ['company', 'who', 'about', 'made', 'britain', 'madeinbritain', 'shrewsbury', 'where', 'manufacturer', 'support', 'phone', 'contact', 'email', 'history'],
    body: `ABOUT FASTAMPS:
- UK-based designer and manufacturer of EV chargers, HQ Shrewsbury (Darwin House, 2 The Mount, SY3 8PU).
- Products built for installers — speed, simplicity, robustness. "A charger that does what it says on the box."
- MadeInBritain® member. UK-sourced components: plastics (Birmingham), PCBs (Halesowen), foam seals (Leamington Spa), ribbon cable (Leicester), sticky badges (Merseyside), boxes/screws (Shrewsbury).
- UK-based tech support that answers the phone. Contact: 01743 249 900 | info@fastamps.com | www.fastamps.com/contact.`,
  },
  {
    name: 'product',
    keywords: ['alpha7', 'charger', 'spec', 'specification', 'kw', 'amp', 'type 2', 'tethered', 'untethered', 'ip54', 'pen', 'wifi', 'bluetooth', 'warranty', 'size', 'weight', 'temperature', 'feature'],
    body: `ALPHA7 EV CHARGER:
- 7.4kW, 220-240V, 50/60Hz, 32A, Mode 3, Type 2 socket (EN62196), IP54, IK08. UK designed & made.
- Dimensions H270 x W140 x D110mm, 1.1kg. Operating temp -30°C to +50°C.
- Tethered (5m Type 2 cable; 8m special order) or Untethered (no cable).
- Built-in PEN ground-fault protection (18th Ed 722.411.4.1 iv) — no earth rod / external PME PEN device needed.
- Integral 30mA AC + 6mA DC earth leakage. No WiFi needed to function (only for remote access).
- Features: next-day delivery, WiFi & Ethernet, Bluetooth, NFC/OCPP, dynamic load, solar "zero net export", smart-charge compliant, 3-year warranty, app control. 7.4KW, 32A.`,
  },
  {
    name: 'pricing',
    keywords: ['price', 'cost', 'how much', 'discount', 'vat', '£', 'pound', 'buy', 'order', 'post', 'barrier', 'cable holder', 'consumer unit', 'sensor', 'retail', 'installer price', 'account', 'terms', 'volume'],
    body: `PRICING:
RETAIL (inc VAT): Alpha7 from £399. Stainless Steel Charge Post from £269. Double/Twin Charge Post £299. Powdercoated Steel Post £155. Stainless Barrier from £115. Small Bump Barrier £115. Cable Holder £38. Cable-Up organiser £234. Current Sensor 100A £20. Castlec IP65 EV Consumer Unit £52.84. Installed from £749.
INSTALLER (FastAmps Connect): 25% off Alpha7 → from £299.25 + VAT. 50% off FIRST charger with in-person training. 30 days end-of-month terms for regulars. Free mainland UK delivery. Volume discounts available. Accounts arranged for regular customers.`,
  },
  {
    name: 'programme',
    keywords: ['programme', 'program', 'welcome', 'benefit', 'join', 'sign up', 'lead', 'leads', 'marketing', 'training', 'money back', 'guarantee', 'first charger', 'first install'],
    body: `INSTALLER WELCOME PROGRAMME (FastAmps Connect):
- Visit Shrewsbury for training; learn install/commissioning tips from experts.
- Free support on your FIRST installation — as many video calls as needed with tech support.
- 25% off Alpha7 (from £299.25 + VAT). 50% off first charger with in-person training.
- Order by email/phone with next-day delivery. 30 days end-of-month terms. Free mainland UK delivery.
- 30-day 100% money-back guarantee, even if installed.
- Leads passed to you for your local area when customers contact FastAmps direct.
- Marketing material to promote the Alpha7 on your site/socials.`,
  },
  {
    name: 'install-prep',
    keywords: ['mount', 'mounting', 'fix', 'drill', 'height', 'gland', 'template', 'screw', 'torx', 'sunlight', 'install', 'preparation', 'bluetooth passcode', 'commission'],
    body: `INSTALLATION PREPARATION:
- Mount 0.9–1.5m high. Indoor/outdoor; surface or post.
- 4x stainless screws (supplied), 8mm drill, ≥40mm deep, centres 95(w) x 215(h)mm. DeWalt plugs supplied. T20 security torx bit supplied. Box insert = template.
- Avoid direct sunlight. DO NOT fit glands to the TOP (water ingress). Bottom/rear/LHS/RHS OK. Glands up to M40 (cable OD 28mm). Dimples show gland placement.
- Cable up to 10mm sq / 6AWG; chamber fits 16mm SWA. Front unclips via ribbon for access.
- Bluetooth passcode in 4 places: manual, box, delivery paperwork, inside charger. Bluetooth commissioning via app — WiFi only needed for remote access.`,
  },
  {
    name: 'electrical',
    keywords: ['mcb', 'rcbo', 'rcd', 'cable size', 'mm sq', 'torque', 'voltage', 'wiring', 'terminal', 'earth', 'live', 'neutral', 'supply', 'dip', 'amp', '6a', '12a', '20a', '32a', 'step'],
    body: `ELECTRICAL REQUIREMENTS:
- 32A: 40A Type C MCB/RCBO, 6mm sq typical. 16A: 20A Type C MCB/RCBO, 4mm sq typical.
- 30mA type A RCD (integral 30mA AC + 6mA DC also included). Under-voltage 207V, over-voltage 253V.
- Supply L1/N/PE 2.5–10mm sq. Torque 1.3Nm power, 0.5Nm control.
INSTALL STEPS: 1) cable dead. 2) AMP DIP (LHS): 6A=OFF/OFF, 12A=ON/OFF, 20A=OFF/ON, 32A=ON/ON (default). 3) MAINS IN L/N/PE correct polarity. 4) Tethered: VEHICLE connector, white CP to J4. 5) Tighten glands. 6) Lid on, 4 screws 2Nm.`,
  },
  {
    name: 'dlm',
    keywords: ['dynamic', 'load', 'balancing', 'dlm', 'acct', 'ct', 'clamp', 'coil', 'meter', 'dyn', '80a', '100a', '130a'],
    body: `DYNAMIC LOAD BALANCING (DYN, centre DIP):
- Needs ACCT (LEM TT 100-SD / RS 198-885, or any 3000:1). Clamp on meter input cable; measures total current, reduces charge rate so supply never exceeds fuse rating.
- ACCT to J6 "DYN LOAD" (0.5Nm, polarity irrelevant). DIP: 80A=ON/OFF, 100A=OFF/ON, 130A=ON/ON, Disabled=OFF/OFF (default).
- DLM LED flashes when output reduced. Consider main fuse rating + existing load. Select a CT coil on your order.`,
  },
  {
    name: 'twin',
    keywords: ['twin', 'sharing', 'two chargers', 'net', 'master', 'slave', 'rj45', 'j3', 'j5', 'two cars'],
    body: `TWIN LOAD SHARING (NET, RHS DIP):
- Two Alpha7 share up to 32A, no ACCT. Master=ON/ON, Slave=OFF/ON.
- RJ45 to J3, or cable to J5 (+/– twisted pair, 0V, max 20m). First EV up to 32A; second shares — both up to 16A.`,
  },
  {
    name: 'solar',
    keywords: ['solar', 'zero net export', 'pv', 'inverter', 'green energy'],
    body: `SOLAR ("ZERO NET EXPORT"):
- ACCT on solar inverter output → J5 "SOLAR" on Power PCB (0.5Nm, polarity irrelevant). Enabled via app (default off). Min charge rate with solar 6A. Press solar button; DLM LED shows when engaged.`,
  },
  {
    name: 'led',
    keywords: ['led', 'light', 'colour', 'color', 'red', 'blue', 'green', 'yellow', 'pink', 'white', 'fault', 'error', 'flash', 'flashing', 'blinking', 'indicator', 'ready', 'charging'],
    body: `LED INDICATORS:
- Blue=ready. Blue flash=delay (off-peak/random 0–600s). Green=charging. Green flash=finished.
- Yellow=over temp (>80°C; resumes <70°C; limited to 20A above 75°C). Yellow flash=lock open/close error — reseat connector.
- Red=RCD/relay fault — power cycle at MCB, wait 5s. Red flash=comms error.
- Red/Blue flash=under voltage (<207V) — power cycle. Red/Yellow flash=over voltage (>253V) — power cycle. Blue/Yellow flash=twin-sharing comms error — power cycle.
- Pink flash=over-current — lower car's charge setting. White=clock error — reconnect via app. White flash=battery low. Multi-coloured=app lock active.`,
  },
  {
    name: 'charging',
    keywords: ['charge', 'start', 'stop', 'how to', 'cable', 'lock', 'plug', 'car', 'rain', 'weather', 'granny'],
    body: `HOW TO CHARGE:
START: unlock car, connect cable to car + Alpha7, press "Now" → green LED = charging. Without Now: random delay up to 10 mins, then off-peak (default 10pm–8am, 11am–4pm).
STOP: unlock car, disconnect from car then Alpha7. Cable locks to charger until car sends unlock (safety/security).
Safe in rain: yes — no high voltage on pins until safe handshake; earth pin first, then N, then L; multiple RCD protections. Granny charger works but ~2.5x slower.`,
  },
  {
    name: 'app',
    keywords: ['app', 'bluetooth', 'phone', 'mobile', 'firmware', 'history', 'lock', 'schedule', 'timer', 'update'],
    body: `MOBILE APP (Bluetooth):
- Add/name charger, real-time status, start/stop, lock/unlock, history (week/month/year), export data, set charge times, enable/disable solar, charge now, change randomised delay. Firmware updates for 3+ years. App lock disables charger (LED colour-changing when on).`,
  },
  {
    name: 'maintenance',
    keywords: ['maintenance', 'clean', 'wash', 'care', 'warranty', 'guarantee', 'serial', 'cover', 'repair'],
    body: `MAINTENANCE & WARRANTY:
- pH neutral cleaner, non-abrasive sponge. No high-pressure washers. Keep socket covers on when not in use.
- 3-year warranty from sale (parts & labour). Extend to start from install date — email info@fastamps.com with Serial No, Install Date, Installer Name/Address/Tel, Install Postcode. Excludes removal/re-install costs, scratches/dents, improper install, defaced serial. 30-day 100% money-back guarantee, even if installed.`,
  },
  {
    name: 'faq',
    keywords: ['faq', 'question', 'recommend', 'installer', 'country', 'cable size', 'cost', 'time', 'easy', 'gland', 'volume', 'account', 'connector', 'type 1', 'type 2', 'ccs', 'chademo'],
    body: `FAQ (website):
USERS: speak to a qualified installer before buying. Cable size: 16A≈4mm sq, 32A≈6mm sq (installer confirms). Install cost from ~£750 inc charger/labour/VAT for simple installs; drivers = walls, distance, electrics age, routing, trenches; rates £30–60/hr (£100+ London). Installed from £749. Install time ~couple of hours; book ~2 weeks ahead. UK market now; designed EU/USA compatible.
INSTALLERS: easy to install — template, DeWalt plugs, stainless screws, T20 bit, any-direction cable entry, finger space, oversized terminals, DIP-switch config, Bluetooth commissioning. No earth rod (PEN protection built in). Consider DLM kit for main fuse/load. Glands not pre-fitted (dimples guide placement; CT coil ships with a gland). Mounting: 4 holes 215x95mm, 8mm drill ≥40mm. Volume discounts + accounts for regulars. Connectors: Type 1 (pre-2014 imports), Type 2 (all UK now, AC), CCS2 (all UK now, DC rapid), Chademo (pre-2014 imports, DC ≤50kW).`,
  },
];

// Always include a compact core so pricing/programme reminders are available even on off-topic questions.
const ALWAYS = SECTIONS.filter(s => ['product', 'pricing', 'programme'].includes(s.name));

function retrieveSections(question) {
  const q = question.toLowerCase();
  const matched = SECTIONS.filter(s =>
    s.keywords.some(k => q.includes(k.toLowerCase()))
  );
  // Dedupe by name, keep order: matched first, then always-on extras not already matched.
  const chosen = [...matched];
  for (const s of ALWAYS) {
    if (!chosen.includes(s)) chosen.push(s);
  }
  return chosen;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const question: string = (body?.question || '').toString().trim();
    const history: Array<{ role: string; text: string }> = Array.isArray(body?.history) ? body.history : [];
    if (!question) return Response.json({ error: 'No question provided' }, { status: 400 });

    // Cap conversation history to the last 6 messages to control token usage.
    const recent = history.slice(-6);

    const sections = retrieveSections(question);
    const knowledge = [CORE, ...sections.map(s => s.body)].join('\n\n');

    const historyText = recent
      .map(m => `${m.role === 'user' ? 'Installer' : 'Coach'}: ${m.text}`)
      .join('\n');

    const prompt = `${knowledge}\n\n--- Conversation so far ---\n${historyText}\n\nInstaller: ${question}\n\nCoach:`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'gpt_5_mini',
    });

    const answer = typeof result === 'string' ? result : (result?.response ?? result?.answer ?? JSON.stringify(result));
    return Response.json({ answer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}