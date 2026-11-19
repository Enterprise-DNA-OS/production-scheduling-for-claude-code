#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
import {inputs,plan,dateOnly,timestamp,fingerprint} from './lib/planner.mjs';
const reads={'resources':'select code,name,kind,daily_minutes,hold,evidence,review_due from scheduling.resources order by code','operations':'select * from scheduling.operation_list order by order_code,sequence','capacity':'select * from scheduling.capacity order by queued_minutes desc,code','compliance':'select * from scheduling.compliance order by rule,record','overdue':'select * from scheduling.overdue order by due_at,code','closures':'select r.code,c.closed_on,c.reason from scheduling.closures c join scheduling.resources r on r.id=c.resource_id order by c.closed_on,r.code','history':'select action,actor,detail,created_at from scheduling.activity order by created_at,id'};
export const commandNames=[...Object.keys(reads),'plan','dispatch','late-orders','attention','weekly-review','record','add-resource','set-resource','add-operation','set-operation','close-day','log','import','export','draft-dispatch'];
function options(argv){const opts={},args=[];for(const a of argv){if(a.startsWith('--')){const i=a.indexOf('=');opts[a.slice(2,i<0?undefined:i)]=i<0?true:a.slice(i+1);}else args.push(a);}return {opts,args};}
const required=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Requires --${k}=value`);return o[k].trim();};
function integer(v,min=0,max=100000){if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(+v)||+v<min||+v>max)throw Error(`Integer required between ${min} and ${max}`);return +v;}
function bool(v){if(v!=='true'&&v!=='false')throw Error('Boolean must be true or false');return v==='true';}
async function resolve(db,kind,q){if(!q)throw Error('A record reference is required');const col=kind==='resources'?'name':'order_code';const rows=await db.query(`select * from scheduling.${kind} where lower(code)=lower($1) or lower(${col})=lower($1) or id::text ilike $2 order by code`,[q,q+'%']);if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'No matching'} ${kind}: ${rows.map(r=>r.code+' '+r.id).join(', ')||q}`);return rows[0];}
async function addResource(db,o){const kind=required(o,'kind');if(!['machine','operator'].includes(kind))throw Error('kind must be machine or operator');return (await db.query('insert into scheduling.resources(code,name,kind,daily_minutes) values($1,$2,$3,$4) returning code',[required(o,'code'),required(o,'name'),kind,integer(o.minutes??480,1,480)]))[0];}
async function addOperation(db,o){const m=await resolve(db,'resources',required(o,'machine')),p=await resolve(db,'resources',required(o,'operator'));return (await db.query(`insert into scheduling.operations(code,order_code,sequence,machine_id,operator_id,setup_minutes,run_minutes,ready_at,due_at,material_ready,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning code`,[required(o,'code'),required(o,'order'),integer(required(o,'sequence'),1),m.id,p.id,integer(o.setup??0),integer(required(o,'run'),1),timestamp(required(o,'ready')),timestamp(required(o,'due')),o.material?bool(o.material):false,o.note||'']))[0];}
async function importSkyplanner(db,file){
 if(!file)throw Error('import skyplanner <csv-file> required');const raw=fs.readFileSync(file,'utf8');const rows=parseCsv(raw);if(!rows.length)throw Error('Empty import');
 const expected=['Order / operation','Machine / operator','Setup min','Run min','Start','End','Due','Status'];
 if(expected.some(k=>!(k in rows[0])))throw Error('Expected SkyPlanner production schedule template headers; see replace guide');
 let added=0,unchanged=0;const seen=new Set();
 for(const row of rows){const pair=v=>{const a=v.split(/\s*\/\s*/);if(a.length!==2||a.some(x=>!x.trim()))throw Error('Expected two codes separated by /');return a.map(x=>x.trim());};
  const [order,code]=pair(row['Order / operation']),[machine,operator]=pair(row['Machine / operator']);
  if(seen.has(code.toLowerCase()))throw Error('Duplicate operation in file: '+code);seen.add(code.toLowerCase());
  const key='skyplanner:'+code,hash=createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const old=await db.query('select source_hash from scheduling.operations where source_key=$1',[key]);
  if(old.length){if(old[0].source_hash!==hash)throw Error('Changed source row '+code+': reconcile through set-operation; import never overwrites history');unchanged++;continue;}
  if(row.Status.toLowerCase()!=='planned')throw Error('Only Planned template rows supported; archive completed history separately');
  timestamp(row.End); // Source end is retained, not treated as proof of available capacity.
  const seq=code.match(/(?:-|_)(\d+)$/)?.[1];if(!seq)throw Error('Operation code needs numeric routing suffix, e.g. FRAME-10');
  for(const [c,k] of [[machine,'machine'],[operator,'operator']]){const found=await db.query('select * from scheduling.resources where lower(code)=lower($1)',[c]);if(!found.length)await addResource(db,{code:c,name:c,kind:k});else if(found[0].kind!==k)throw Error('Resource kind collision: '+c);}
  await addOperation(db,{code,order,sequence:seq,machine,operator,setup:row['Setup min'],run:row['Run min'],ready:row.Start,due:row.Due,note:'Imported planning template; verify materials and resource evidence'});
  await db.query('update scheduling.operations set source_key=$1,source_payload=$2,source_hash=$3 where code=$4',[key,JSON.stringify(row),hash,code]);added++;
 }
 return {added,unchanged,source_sha256:createHash('sha256').update(raw).digest('hex'),warning:'New resources remain held. Verify evidence, shift capacity and material readiness before scheduling.'};
}
export async function execute(db,argv){
 const {args,opts:o}=options(argv),[cmd,ref,...rest]=args;
 if(cmd==='help'||!cmd||o.help)return {commands:commandNames,usage:'npm run schedule -- <command> [record] --key=value --json; see docs/cli.md'};
 if(!commandNames.includes(cmd))throw Error('Unknown command: '+cmd);
 const allowed={
 'add-resource':['code','name','kind','minutes'],'set-resource':['hold','evidence','review','minutes'],
 'add-operation':['code','order','sequence','machine','operator','setup','run','ready','due','material','note'],
 'set-operation':['material','ready','due','status','reason','note'],'close-day':['date','reason'],'log':['note'],
 'plan':['start','horizon','save'],'dispatch':['start','horizon'],'late-orders':['start','horizon'],
 'attention':['start','horizon'],'weekly-review':['start','horizon'],'draft-dispatch':['start','horizon']};
 for(const k of Object.keys(o)){if(!['json','actor','dry-run','help',...(allowed[cmd]||[])].includes(k))throw Error('Unknown option: --'+k);if(['json','dry-run','save'].includes(k)&&o[k]!==true)throw Error('--'+k+' is a bare flag');}
 const maxArgs=cmd==='import'?3:['record','set-resource','set-operation','close-day','log','export'].includes(cmd)?2:1;
 if(args.length>maxArgs)throw Error('Unexpected positional argument');
 const start=dateOnly(o.start||new Date().toISOString().slice(0,10));
 const write=['add-resource','set-resource','add-operation','set-operation','close-day','log','import'].includes(cmd)||(cmd==='plan'&&o.save);
 if(o['dry-run']&&!write)throw Error('--dry-run applies to database writes only');
 if(write)required(o,'actor');
 await db.exec(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  if(write)await db.exec('LOCK TABLE scheduling.resources,scheduling.operations,scheduling.closures IN SHARE ROW EXCLUSIVE MODE');
  let result;
  if(cmd in reads)result=await db.query(reads[cmd]);
  else if(['plan','dispatch','late-orders','attention','weekly-review','draft-dispatch'].includes(cmd)){
   const data=await inputs(db),p=plan(data,start,integer(o.horizon??90,1,365));
   if(cmd==='plan'){result=p;if(o.save)result.run=(await db.query('insert into scheduling.plan_runs(start_on,fingerprint,actor,result) values($1,$2,$3,$4) returning id',[start,p.fingerprint,o.actor,JSON.stringify(p)]))[0].id;}
   if(cmd==='dispatch')result=p.slots;
   if(cmd==='late-orders')result=p.rows.filter(r=>r.state==='late'||r.state==='blocked');
   if(cmd==='attention'||cmd==='weekly-review')result={plan:p.rows,checks:await db.query(reads.compliance),capacity:await db.query(reads.capacity)};
   if(cmd==='draft-dispatch'){
    const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,`dispatch-${start}-${Date.now()}.md`);
    fs.writeFileSync(file,'# Draft dispatch review\n\nProposed work, not machine instructions. Confirm materials, competence and isolation controls on site.\n\n'+display(p.slots)+'\n\nExceptions\n'+display(p.rows.filter(r=>r.state!=='on time'))+'\n',{flag:'wx',mode:0o600});result={file};
   }
  }else if(cmd==='record'){const r=await resolve(db,'operations',ref);result={...r,machine:(await db.query('select code from scheduling.resources where id=$1',[r.machine_id]))[0].code,operator:(await db.query('select code from scheduling.resources where id=$1',[r.operator_id]))[0].code};}
  else if(cmd==='add-resource')result=await addResource(db,o);
  else if(cmd==='set-resource'){
   const r=await resolve(db,'resources',ref);const hold=o.hold===undefined?r.hold:bool(o.hold),evidence=o.evidence??r.evidence,review=o.review?dateOnly(o.review):r.review_due;
   if(!hold&&(!evidence||!review||review<new Date().toISOString().slice(0,10)))throw Error('Release needs current review date and evidence');
   result=await db.query('update scheduling.resources set hold=$1,evidence=$2,review_due=$3,daily_minutes=$4 where id=$5 returning code,hold,review_due',[hold,evidence,review,integer(o.minutes??r.daily_minutes,1,480),r.id]);
  }else if(cmd==='add-operation')result=await addOperation(db,o);
  else if(cmd==='set-operation'){
   const r=await resolve(db,'operations',ref);if(r.status!=='planned')throw Error('Completed or cancelled operation is closed; add a correction operation');
   const status=o.status??r.status;
   if(['done','cancelled'].includes(status))required(o,'reason');
   if(status==='done'&&(await db.query("select code from scheduling.operations where order_code=$1 and sequence<$2 and status='planned'",[r.order_code,r.sequence])).length)throw Error('Complete preceding operations first');
   result=await db.query('update scheduling.operations set material_ready=$1,ready_at=$2,due_at=$3,status=$4,note=$5 where id=$6 returning code,status',[o.material===undefined?r.material_ready:bool(o.material),o.ready?timestamp(o.ready):r.ready_at,o.due?timestamp(o.due):r.due_at,status,o.reason??o.note??r.note,r.id]);
  }else if(cmd==='close-day'){const r=await resolve(db,'resources',ref);result=await db.query('insert into scheduling.closures(resource_id,closed_on,reason) values($1,$2,$3) returning closed_on,reason',[r.id,dateOnly(required(o,'date')),required(o,'reason')]);}
  else if(cmd==='log'){const r=await resolve(db,'operations',ref);result={operation:r.code,note:required(o,'note')};}
  else if(cmd==='import'){if(ref!=='skyplanner')throw Error('Supported import: skyplanner');result=await importSkyplanner(db,rest[0]);}
  else if(cmd==='export'){
   if(!ref)throw Error('export <new-file.json> required');const snapshot={format:'production-scheduling-v1',exported_at:new Date().toISOString(),data:{}};
   for(const t of ['resources','operations','closures','activity','plan_runs'])snapshot.data[t]=await db.query(`select * from scheduling.${t} order by id`);
   fs.writeFileSync(ref,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600});result={file:path.resolve(ref),counts:Object.fromEntries(Object.entries(snapshot.data).map(([k,v])=>[k,v.length]))};
  }
  if(write)await db.query('insert into scheduling.activity(action,actor,detail) values($1,$2,$3)',[cmd,o.actor,JSON.stringify({ref,options:o,result})]);
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return o['dry-run']?{dry_run:true,result}:result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function display(value){if(Array.isArray(value)){if(!value.length)return '(none)';const keys=[...new Set(value.flatMap(Object.keys))];return table(value,keys.map(key=>({key,label:key,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v})));}if(value?.rows)return display(value.rows);return JSON.stringify(value,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):display(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
