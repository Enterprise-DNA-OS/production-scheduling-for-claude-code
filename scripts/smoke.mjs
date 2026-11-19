import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,commandNames,display} from './schedule.mjs';
import {plan,dateOnly,timestamp} from './lib/planner.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'production-scheduling-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
const db=await getDb();let closed=false;const exercised=new Set();
async function run(...args){exercised.add(args[0]);return execute(db,args);}
const actor='--actor=Test planner';
try{
 assert.equal((await db.query("select schema_name from information_schema.schemata where schema_name='scheduling'")).length,0,'Tests require a fresh disposable database');
 await migrate(db);assert.equal((await migrate(db)).ran.length,0);await seed(db);await seed(db);
 assert.equal((await run('operations')).length,5);assert.equal((await run('resources')).length,5);
 for(const cmd of ['capacity','compliance','overdue','closures','history','attention','weekly-review','dispatch','late-orders','help'])await run(cmd);
 const initial=await run('plan');assert(initial.rows.some(r=>r.state==='blocked'));assert(initial.rows.some(r=>r.state==='late'));
 assert.match(display(initial),/FRAME/);assert.equal(display([]),'(none)');
 const makeResource=(id,kind)=>({id,code:id,kind,daily_minutes:480,hold:false,evidence:'test',review_due:'2031-01-01'});
 const data={resources:[makeResource('m','machine'),makeResource('n','machine'),makeResource('p','operator')],closures:[],operations:[
 {code:'A-10',order_code:'A',sequence:10,machine_id:'m',operator_id:'p',setup_minutes:30,run_minutes:570,ready_at:'2030-01-07 08:00',due_at:'2030-01-07 16:00',material_ready:true,status:'planned'},
 {code:'A-20',order_code:'A',sequence:20,machine_id:'n',operator_id:'p',setup_minutes:0,run_minutes:60,ready_at:'2030-01-07 08:00',due_at:'2030-01-08 16:00',material_ready:true,status:'planned'},
 {code:'B-10',order_code:'B',sequence:10,machine_id:'n',operator_id:'p',setup_minutes:0,run_minutes:120,ready_at:'2030-01-07 08:00',due_at:'2030-01-09 16:00',material_ready:true,status:'planned'}]};
 const p=plan(data,'2030-01-07');assert.equal(p.rows[0].finish,'2030-01-08 10:00');assert.equal(p.rows[1].start,'2030-01-08 10:00');
 for(let i=0;i<p.slots.length;i++)for(let j=i+1;j<p.slots.length;j++){const a=p.slots[i],b=p.slots[j];if(a.machine===b.machine||a.operator===b.operator)assert(a.end<=b.start||b.end<=a.start,'No resource overlap');}
 assert.equal(p.slots.reduce((n,s)=>n+s.minutes,0),780);
 const shutdown=structuredClone(data);shutdown.closures=[{resource_id:'m',closed_on:'2030-01-07'}];assert.equal(plan(shutdown,'2030-01-07').rows[0].start,'2030-01-08 08:00');
 const held=structuredClone(data);held.resources[0].hold=true;assert.equal(plan(held,'2030-01-07').rows[1].state,'blocked');
 const expires=structuredClone(data);expires.resources[0].review_due='2030-01-07';assert.equal(plan(expires,'2030-01-07').rows[0].state,'blocked');
 assert.throws(()=>dateOnly('2030-02-30'));assert.throws(()=>timestamp('2030-01-07 25:00'));
 assert.equal((await run('record','frame-10')).code,'FRAME-10');await assert.rejects(run('record','FRAME'),/Ambiguous/);
 await run('add-resource','--code=TEST-M','--name=Test machine','--kind=machine',actor);
 await run('add-resource','--code=TEST-O','--name=Test operator','--kind=operator',actor);
 await assert.rejects(run('set-resource','TEST-M','--hold=false',actor),/Release needs/);
 for(const code of ['TEST-M','TEST-O'])await run('set-resource',code,'--hold=false','--evidence=Signed test','--review=2099-01-01',actor);
 await run('add-operation','--code=TEST-10','--order=TEST','--sequence=10','--machine=TEST-M','--operator=TEST-O','--setup=10','--run=60','--ready=2030-01-07 08:00','--due=2030-01-07 16:00',actor);
 await run('set-operation','TEST-10','--material=true',actor);await run('log','TEST-10','--note=Stock verified',actor);
 await run('close-day','TEST-M','--date=2030-01-08','--reason=Maintenance',actor);
 const saved=await run('plan','--save',actor);assert(saved.run);
 await assert.rejects(run('set-operation','FRAME-20','--status=done','--reason=Test',actor),/preceding/);
 await run('set-operation','TEST-10','--status=done','--reason=Signed completion',actor);
 await assert.rejects(run('set-operation','TEST-10','--material=false',actor),/closed/);
 const fixture=path.join(REPO_ROOT,'tests/fixtures/skyplanner.csv');
 assert.equal((await run('import','skyplanner',fixture,actor,'--dry-run')).result.added,2);
 assert.equal((await db.query("select * from scheduling.operations where source_key is not null")).length,0);
 assert.equal((await run('import','skyplanner',fixture,actor)).added,2);
 assert.equal((await run('import','skyplanner',fixture,actor)).unchanged,2);
 const imported=await run('record','A-10');assert(imported.source_payload);assert.equal(imported.material_ready,false);
 assert((await run('resources')).find(r=>r.code==='M1').hold);
 const bad=path.join(tmp,'bad.csv');let text=fs.readFileSync(fixture,'utf8');fs.writeFileSync(bad,text.replaceAll('A / A-','C / C-').replace('15,60','15,nope'));
 await assert.rejects(run('import','skyplanner',bad,actor),/Integer/);assert.equal((await db.query("select * from scheduling.operations where order_code='C'")).length,0);
 fs.writeFileSync(bad,text.replace('30,120','31,120'));await assert.rejects(run('import','skyplanner',bad,actor),/Changed source/);
 const out=path.join(tmp,'snapshot.json');await run('export',out);assert.equal(Object.keys(JSON.parse(fs.readFileSync(out)).data).length,5);await assert.rejects(run('export',out),/EEXIST/);
 const draft=await run('draft-dispatch');assert(fs.readFileSync(draft.file,'utf8').includes('Draft dispatch'));
 await assert.rejects(db.query("update scheduling.activity set actor='changed'"),/append-only/);
 await assert.rejects(run('wat'),/Unknown command/);
 for(const c of commandNames)assert(exercised.has(c),'Command not exercised: '+c);
 await db.query("update scheduling.resources set name='<script>alert(1)</script>' where code='TEST-M'");
 await db.close();closed=true;
 for(const script of ['view','docs']){const s=spawnSync(process.execPath,[`scripts/${script}.mjs`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(s.status,0,s.stderr);}
 const files=fs.readdirSync(path.join(tmp,'docs-out','capacity-review'));const html=files.map(f=>fs.readFileSync(path.join(tmp,'docs-out','capacity-review',f),'utf8')).join('');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
 const cli=spawnSync(process.execPath,['scripts/schedule.mjs','record','FRAME'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(cli.status,1);assert.match(cli.stderr,/Ambiguous/);
 console.log(`PASS: ${commandNames.length} CLI commands; capacity conflicts, precedence, holds, expiry, closures, atomic/idempotent imports, history, documents and escaping (${db.mode})`);
}finally{if(!closed)await db.close();fs.rmSync(tmp,{recursive:true,force:true});}
