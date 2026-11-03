import { createClientFromRequest } from "npm:@base44/sdk";

// Validate an entire manufacturing CSV server-side against the COMPLETE register.
// No QR record is created until every input serial and PIN has passed validation.
const PAGE_SIZE = 2000;
const MAX_ROWS = 10000;
const MAX_REGISTER = 200000;
const normalizeSerial = (value: unknown) => String(value ?? "").trim().toUpperCase();
const normalizePin = (value: unknown) => String(value ?? "").trim();
type Candidate = { serial_number: string; pin_code: string; product_model?: string; [key:string]:unknown };
type Issue = { row: number; field: string; value: string; code: string; message: string };
const allowedDistributionKeys = [
  "supplied_to_type", "supplied_to_name_raw", "supplied_to_branch_raw", "source_batch_identifier",
  "distribution_branch_id", "distribution_wholesaler_name", "distribution_branch_name", "distribution_match_status",
];
const safeBatch = (v: unknown) => String(v ?? "").trim();

function uniqueCollisions(rows: any[], fileRows: Candidate[], batchName: string, single = false): Issue[] {
  const issues: Issue[] = [];
  const serials = new Map<string, { batch: string }>();
  const pins = new Map<string, { batch: string }>();
  const batches = new Set<string>();
  for (const row of rows) {
    const serial = normalizeSerial(row.serial_number);
    const pin = normalizePin(row.pin_code);
    if (serial && !serials.has(serial)) serials.set(serial, { batch: row.batch_reference || "Unknown batch" });
    if (pin && !pins.has(pin)) pins.set(pin, { batch: row.batch_reference || "Unknown batch" });
    if (row.batch_reference) batches.add(String(row.batch_reference).toUpperCase());
  }
  if (!single && batches.has(batchName.toUpperCase())) {
    issues.push({ row: 0, field: "batch_reference", value: batchName,
      code: "batch_exists", message: "This batch reference already exists. Choose a new one." });
  }
  const inFileSerial = new Map<string, number>();
  const inFilePin = new Map<string, number>();
  for (const [index, item] of fileRows.entries()) {
    const row = index + 2; // CSV row 1 is the header.
    const serial = normalizeSerial(item.serial_number);
    const pin = normalizePin(item.pin_code);
    if (!serial) issues.push({ row, field: "serial_number", value: serial,
      code: "missing_serial", message: "Serial number is missing." });
    if (!/^\d{6}$/.test(pin)) issues.push({ row, field: "pin_code", value: pin,
      code: "invalid_pin", message: "PIN must contain exactly six digits (including leading zeros)." });
    if (serial) {
      if (serials.has(serial)) issues.push({ row, field: "serial_number", value: serial,
        code: "serial_registered", message: `Serial already registered in ${serials.get(serial)!.batch}.` });
      if (inFileSerial.has(serial)) issues.push({ row, field: "serial_number", value: serial,
        code: "serial_duplicate_in_file", message: `Same serial was already provided on CSV row ${inFileSerial.get(serial)}.` });
      else inFileSerial.set(serial,row);
    }
    if (/^\d{6}$/.test(pin)) {
      if (pins.has(pin)) issues.push({ row, field: "pin_code", value: pin,
        code: "pin_registered", message: `PIN already used in ${pins.get(pin)!.batch}.` });
      if (inFilePin.has(pin)) issues.push({ row, field: "pin_code", value: pin,
        code: "pin_duplicate_in_file", message: `Same PIN was already provided on CSV row ${inFilePin.get(pin)}.` });
      else inFilePin.set(pin,row);
    }
  }
  return issues;
}

async function getAllIdentifiers(entity: any) {
  const register: any[] = [];
  for (let skip=0;skip<MAX_REGISTER;skip+=PAGE_SIZE) {
    const page = await entity.list("-created_date",PAGE_SIZE,skip,
      ["id","serial_number","pin_code","batch_reference","source_import_id"]);
    if (!Array.isArray(page)) throw new Error("The full charger register could not be checked.");
    register.push(...page);
    if (page.length < PAGE_SIZE) return register;
  }
  throw new Error("The charger register is too large to verify fully. No records were imported.");
}

// A freshly written charger can briefly be missing from the register read, which used to
// look like a duplicate and rolled back perfectly valid imports. Re-read before deciding.
async function auditWrittenRows(entity:any, input:Candidate[]) {
  for (let attempt=0; attempt<5; attempt++) {
    const register = await getAllIdentifiers(entity);
    const serialCounts = new Map<string,number>(), pinCounts = new Map<string,number>();
    for (const c of register) {
      const serial=normalizeSerial(c.serial_number),pin=normalizePin(c.pin_code);
      if (serial) serialCounts.set(serial,(serialCounts.get(serial)||0)+1);
      if (pin) pinCounts.set(pin,(pinCounts.get(pin)||0)+1);
    }
    const duplicated = input.some(r=>(serialCounts.get(r.serial_number)||0)>1 || (pinCounts.get(r.pin_code)||0)>1);
    if (duplicated)
      throw new Error("Duplicate serial or PIN was detected during final verification. This import is being rolled back.");
    const notYetVisible = input.some(r=>(serialCounts.get(r.serial_number)||0)===0 || (pinCounts.get(r.pin_code)||0)===0);
    if (!notYetVisible) return;
    await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
  }
  // Every row was already confirmed by its own write, so a row still absent after repeated
  // reads is read lag rather than a duplicate: keep the import.
}

async function removeThisImport(db:any, importId:string) {
  await db.asServiceRole.entities.Charger.deleteMany({source_import_id:importId});
  await db.asServiceRole.entities.ChargerCodeHistory.deleteMany({source_import_id:importId});
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({error:"Method not allowed"}, {status:405});
  const db = createClientFromRequest(req);
  try {
    const admin = await db.auth.me();
    if (!admin?.email || admin.role !== "admin") return Response.json({error:"Admin access required."},{status:403});
    const body = await req.json();
    const action = String(body.action || "validate");
    if (!["validate","import"].includes(action)) return Response.json({error:"Invalid import operation."},{status:400});
    const entries = body.rows;
    const batchName = safeBatch(body.batch_reference);
    if (!Array.isArray(entries) || entries.length<1 || entries.length>MAX_ROWS)
      return Response.json({error:`Select a CSV containing 1 to ${MAX_ROWS.toLocaleString()} rows.`},{status:400});
    if (!batchName || batchName.length>120)
      return Response.json({error:"Enter a batch reference (1–120 characters)."}, {status:400});

    const input:Candidate[] = entries.map((r:any)=>({
      serial_number:normalizeSerial(r.serial_number),
      pin_code:normalizePin(r.pin_code),
      product_model:String(r.product_model||"Alpha 7").trim().slice(0,80)||"Alpha 7",
      ...Object.fromEntries(allowedDistributionKeys
        .filter(key=>r[key]!==undefined)
        .map(key=>[key,String(r[key]??"").slice(0,500)])),
    }));
    // Always re-check on import; never trust a previous client-side validation.
    const existing = await getAllIdentifiers(db.asServiceRole.entities.Charger);
    const retired = await getAllIdentifiers(db.asServiceRole.entities.ChargerCodeHistory);
    const issues = uniqueCollisions([...existing,...retired],input,batchName,body.single===true && entries.length===1);
    if (issues.length) return Response.json({
      valid:false, register_checked:existing.length, rows_checked:input.length,
      conflict_count:issues.length, issues, created_count:0,
      error:"CSV validation failed. Nothing was imported. Correct all listed duplicate serial numbers or PINs.",
    },{status:409});
    if (action==="validate") return Response.json({
      valid:true,rows_checked:input.length,register_checked:existing.length,conflict_count:0,issues:[],created_count:0,
    });
    const importId = crypto.randomUUID();
    const allCreated:any[] = [];
    try {
      for(let i=0;i<input.length;i+=100) {
        const group=input.slice(i,i+100).map(row=>({
          ...row,
          claim_token:crypto.randomUUID().replaceAll("-",""),
          batch_reference:batchName,
          source_import_id:importId,
          claim_status:"available",
          qr_generated:body.qr_generated!==false,
          is_demo:body.single===true && body.is_demo===true,
          demo_label:body.single===true && body.is_demo===true?(String(body.demo_label||"").trim()||"HOME-BETA"):"",
          qr_download_count:0,
        }));
        const result = await db.asServiceRole.entities.Charger.bulkCreate(group);
        if(!Array.isArray(result) || result.length!==group.length)
          throw new Error("The database did not confirm every created charger.");
        allCreated.push(...result);
        const logged = await db.asServiceRole.entities.ChargerCodeHistory.bulkCreate(group.map(c=>({
          serial_number:c.serial_number,pin_code:c.pin_code,batch_reference:batchName,
          source_import_id:importId,recorded_at:new Date().toISOString(),
        })));
        if(!Array.isArray(logged) || logged.length!==group.length)
          throw new Error('Permanent serial/PIN history could not be saved for every charger.');
      }
      // Post-write audit catches overlap from competing imports or another admin.
      // It is a safety check, not a substitute for database unique constraints.
      await auditWrittenRows(db.asServiceRole.entities.Charger, input);
      return Response.json({
        success:true,valid:true,created_count:allCreated.length,
        register_checked:existing.length,import_id:importId,
        chargers:allCreated.map(c=>({
          id:c.id,serial_number:c.serial_number,pin_code:c.pin_code,
          product_model:c.product_model,claim_token:c.claim_token,
          batch_reference:c.batch_reference,claim_status:c.claim_status,
          qr_generated:c.qr_generated,is_demo:c.is_demo,demo_label:c.demo_label,
          distribution_match_status:c.distribution_match_status,
          created_date:c.created_date,
        })),
      });
    } catch(error) {
      try { await removeThisImport(db,importId); }
      catch(rollbackError) {
        console.error("Critical: import rollback incomplete",importId,rollbackError);
        return Response.json({
          error:"The import failed and automatic cleanup needs admin attention. Do NOT print labels.",
          import_id:importId, created_count:0, requires_manual_review:true,
        },{status:500});
      }
      return Response.json({
        error:error instanceof Error?error.message:"Import failed. Changes were rolled back.",
        created_count:0,rolled_back:true,
      },{status:409});
    }
  } catch(error) {
    console.error("import-charger-batch error",error);
    return Response.json({error:error instanceof Error?error.message:"Import validation failed. No records were imported."},
      {status:500});
  }
});