// Converts a calendar date/time in a named timezone to a real UTC timestamp,
// including UK daylight saving. All selected hours (09:30–16:30) avoid DST transition hours.
function toUtc(calendar,zone) {
  const target=Date.UTC(calendar.getUTCFullYear(),calendar.getUTCMonth(),calendar.getUTCDate(),calendar.getUTCHours(),calendar.getUTCMinutes());
  let value=target;
  const formatter=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",
    day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  for(let i=0;i<3;i++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(value)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));
    const seen=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
    value+=target-seen;
  }
  return new Date(value);
}
export function buildHeldPlan(drafts,startLocal,maxDaily,timezone) {
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(startLocal))throw Error("Select a start date and local time.");
  const cursor=new Date(startLocal+":00Z"); // Wall-clock calendar, not actual UTC yet.
  if(Number.isNaN(cursor.getTime()))throw Error("Invalid scheduling date.");
  if(cursor.getUTCHours()<9||cursor.getUTCHours()>16)throw Error("Choose a start between 09:00 and 16:30.");
  if(!Number.isInteger(maxDaily)||maxDaily<1||maxDaily>75)throw Error("Choose 1–75 planned messages per working day.");
  const result=[];
  const step=Math.max(4,Math.floor(420/maxDaily));
  let daily=0;
  for(const draft of drafts) {
    while(true){
      const weekday=cursor.getUTCDay();
      const minuteOfDay=cursor.getUTCHours()*60+cursor.getUTCMinutes();
      if(weekday===0||weekday===6||minuteOfDay>16*60+30||daily>=maxDaily){
        cursor.setUTCDate(cursor.getUTCDate()+1);
        cursor.setUTCHours(9,30,0,0);
        daily=0;
        continue;
      }
      if(minuteOfDay<9*60+30)cursor.setUTCHours(9,30,0,0);
      break;
    }
    result.push({id:draft.id,scheduled_at:toUtc(cursor,timezone).toISOString()});
    daily++;
    cursor.setUTCMinutes(cursor.getUTCMinutes()+step);
  }
  return result;
}
