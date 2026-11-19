import {createHash} from 'node:crypto';
export function dateOnly(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('Expected a real YYYY-MM-DD date');return s;}
export function timestamp(s){s=String(s).replace('T',' ');if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s))throw Error('Expected factory-local YYYY-MM-DD HH:MM');dateOnly(s.slice(0,10));if(+s.slice(11,13)>23||+s.slice(14,16)>59||+(s.slice(17,19)||0)!==0)throw Error('Invalid time');return s.length===16?s+':00':s;}
const minute=s=>Date.parse(timestamp(s).replace(' ','T')+'Z')/60000;
const stamp=m=>new Date(m*60000).toISOString().slice(0,16).replace('T',' ');
export async function inputs(db){return {resources:await db.query('select * from scheduling.resources order by code'),operations:await db.query('select * from scheduling.operations order by order_code,sequence'),closures:await db.query('select * from scheduling.closures order by resource_id,closed_on')};}
export const fingerprint=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
// Deterministic earliest-due-order heuristic, with exact minute capacity and route precedence.
// Factory-local calendar, weekdays 08:00-16:00, split operations across shifts. No optimisation claim.
export function plan(data,startOn,horizon=90){
 dateOnly(startOn); const start=minute(startOn+' 08:00');const end=start+horizon*1440;
 const resources=new Map(data.resources.map(r=>[r.id,r])); const used=new Map();
 const closed=new Set(data.closures.map(c=>c.resource_id+'|'+c.closed_on));
 const groups=new Map();for(const o of data.operations.filter(o=>o.status!=='cancelled')){if(!groups.has(o.order_code))groups.set(o.order_code,[]);groups.get(o.order_code).push(o);}
 const ordered=[...groups].sort((a,b)=>Math.min(...a[1].map(o=>minute(o.due_at)))-Math.min(...b[1].map(o=>minute(o.due_at)))||a[0].localeCompare(b[0]));
 const rows=[],slots=[];
 for(const [order,ops] of ordered){let predecessor=start,blocked=false;
  for(const o of ops.sort((a,b)=>a.sequence-b.sequence)){
   if(o.status==='done')continue;
   const rs=[resources.get(o.machine_id),resources.get(o.operator_id)];
   let reason=blocked?'Earlier operation is blocked':!o.material_ready?'Material readiness unconfirmed':rs.some(r=>!r||r.hold)?'Resource on hold':rs.some(r=>!r.evidence||!r.review_due||r.review_due<startOn)?'Resource review missing or expired':'';
   const allocations=[];let remaining=o.setup_minutes+o.run_minutes;
   if(!reason){for(let m=Math.max(start,predecessor,minute(o.ready_at));m<end&&remaining;m++){
    const d=new Date(m*60000),day=d.toISOString().slice(0,10),clock=d.getUTCHours()*60+d.getUTCMinutes();
    if(d.getUTCDay()===0||d.getUTCDay()===6||clock<480||clock>=960)continue;
    if(rs.some(r=>day>r.review_due||clock>=480+r.daily_minutes||closed.has(r.id+'|'+day)||used.get(r.id)?.has(m)))continue;
    allocations.push(m);remaining--;
   }
   if(remaining)reason='No capacity within planning horizon';}
   if(reason){blocked=true;rows.push({operation:o.code,order,machine:rs[0]?.code,operator:rs[1]?.code,state:'blocked',reason});continue;}
   for(const m of allocations)for(const r of rs){if(!used.has(r.id))used.set(r.id,new Set());used.get(r.id).add(m);}
   let segment=null;for(const m of allocations){if(segment&&segment.end===m)segment.end=m+1;else{segment={operation:o.code,machine:rs[0].code,operator:rs[1].code,start:m,end:m+1};slots.push(segment);}}
   predecessor=allocations.at(-1)+1;
   rows.push({operation:o.code,order,machine:rs[0].code,operator:rs[1].code,start:stamp(allocations[0]),finish:stamp(predecessor),due:timestamp(o.due_at).slice(0,16),minutes:o.setup_minutes+o.run_minutes,state:predecessor>minute(o.due_at)?'late':'on time',late_minutes:Math.max(0,predecessor-minute(o.due_at))});
  }
 }
 return {start_on:startOn,horizon_days:horizon,fingerprint:fingerprint(data),rows,slots:slots.map(s=>({...s,start:stamp(s.start),end:stamp(s.end),minutes:s.end-s.start}))};
}
