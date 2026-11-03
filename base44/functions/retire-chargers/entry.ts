import {createClientFromRequest} from "npm:@base44/sdk";

// Retire charger records without releasing their serial number or PIN for reuse.
Deno.serve(async req=>{
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
  const db=createClientFromRequest(req);
  try{
    const admin=await db.auth.me();
    if(!admin?.email||admin.role!=="admin")
      return Response.json({error:"FastAmps admin access required"},{status:403});
    const body=await req.json();
    const ids=[...new Set((Array.isArray(body.charger_ids)?body.charger_ids:[])
      .map((x:unknown)=>String(x||"").trim()).filter(Boolean))];
    if(ids.length<1||ids.length>1000)
      return Response.json({error:"Select between 1 and 1,000 unclaimed chargers."},{status:400});
    const records=[];
    for(const id of ids){
      const charger=await db.asServiceRole.entities.Charger.get(id);
      if(!charger) return Response.json({error:"One charger no longer exists. Refresh before deleting."},{status:409});
      if(charger.claim_status!=="available" || charger.install_claim_id)
        return Response.json({error:"Only unclaimed chargers may be retired."},{status:409});
      records.push(charger);
    }
    let logged=0;
    for(const charger of records){
      // New imports were already logged. Preserve older record's identifiers too.
      const matches=await db.asServiceRole.entities.ChargerCodeHistory.filter({
        serial_number:String(charger.serial_number||"").trim().toUpperCase(),
      });
      if(!matches.some((x:any)=>String(x.pin_code||"").trim()===String(charger.pin_code||"").trim())){
        await db.asServiceRole.entities.ChargerCodeHistory.create({
          serial_number:charger.serial_number,pin_code:charger.pin_code,
          batch_reference:charger.batch_reference||"",
          source_import_id:charger.source_import_id||"",
          recorded_at:new Date().toISOString(),
        });
        logged++;
      }
    }
    let deleted=0;
    for(const charger of records){
      await db.asServiceRole.entities.Charger.delete(charger.id);
      deleted++;
    }
    return Response.json({success:true,deleted,history_recorded:logged});
  }catch(error){
    console.error("retire-chargers",error);
    return Response.json({error:error instanceof Error?error.message:"Could not retire all records. Refresh."},{status:500});
  }
});
