import test from 'node:test';
import assert from 'node:assert/strict';
import {issueTracking,revokeTracking,readTracking,trackingState} from '../src/tracking.js';
import {createHash} from 'node:crypto';

// Exercita o serviço com um repositório em memória. O SQL ainda deve ser validado
// no PostgreSQL da instalação; este teste não simula o mecanismo do banco.
function repository(){
  const row={id:'66177f37-33f2-4b7f-818c-a239bf89c273',status:'imprimindo',due_date:'2026-10-23',updated_at:new Date(),tracking_version:0,tracking_token_hash:null,tracking_expires_at:null,contact:'Cliente interno',amount_cents:'10000',description:'Dado interno'};
  let calls=0;
  const metadata=()=>({...row,has_link:!!row.tracking_token_hash,enabled:!!row.tracking_token_hash&&row.tracking_expires_at>Date.now()});
  return {row,get calls(){return calls;},async query(sql,args){
    calls++;
    if(sql.startsWith('SELECT id,status'))return{rows:row.tracking_token_hash===args[0]&&row.tracking_expires_at>Date.now()?[{...row}]:[]};
    if(sql.startsWith('SELECT tracking_version'))return{rows:row.id===args[0]?[metadata()]:[],rowCount:row.id===args[0]?1:0};
    const revoke=sql.includes('tracking_token_hash=NULL'),id=revoke?args[0]:args[1],version=revoke?args[1]:args[2];
    if(row.id!==id||row.tracking_version!==version)return{rows:[],rowCount:0};
    row.tracking_token_hash=revoke?null:args[0];row.tracking_expires_at=revoke?null:new Date(Date.now()+90*86400000);row.tracking_version++;
    return{rows:[metadata()],rowCount:1};
  }};
}
test('link aleatório persiste somente hash e resposta pública expõe apenas acompanhamento',async()=>{
  const pool=repository();assert.equal((await trackingState(pool,pool.row.id)).hasLink,false);
  const result=await issueTracking(pool,pool.row.id,0,'https://financeiro.example');
  const url=new URL(result.url),token=url.hash.slice(1);assert.match(token,/^[a-f0-9]{64}$/);assert.equal(url.pathname,'/acompanhar');assert.equal(url.search,'');
  assert.notEqual(pool.row.tracking_token_hash,token);assert.equal(pool.row.tracking_token_hash,createHash('sha256').update(token).digest('hex'));
  const data=await readTracking(pool,token);assert.deepEqual(Object.keys(data).sort(),['dueDate','reference','status','updatedAt']);assert.equal(data.status,'imprimindo');assert.equal(data.dueDate,'2026-10-23');
  assert.ok(!JSON.stringify(data).includes('Cliente interno'));assert.ok(!JSON.stringify(await trackingState(pool,pool.row.id)).includes(token));
  pool.row.status='entregue';assert.equal((await readTracking(pool,token)).status,'entregue');
});
test('renovação e desativação invalidam tokens antigos; versões impedem ações concorrentes',async()=>{
  const pool=repository(),first=await issueTracking(pool,pool.row.id,0,'https://example.com');
  await assert.rejects(()=>issueTracking(pool,pool.row.id,0,'https://example.com'),{status:409});
  const second=await issueTracking(pool,pool.row.id,1,'https://example.com');assert.notEqual(first.url,second.url);
  await assert.rejects(()=>readTracking(pool,new URL(first.url).hash.slice(1)),{status:404});
  assert.equal((await readTracking(pool,new URL(second.url).hash.slice(1))).status,'imprimindo');
  await assert.rejects(()=>revokeTracking(pool,pool.row.id,1),{status:409});await revokeTracking(pool,pool.row.id,2);
  await assert.rejects(()=>readTracking(pool,new URL(second.url).hash.slice(1)),{status:404});assert.equal((await trackingState(pool,pool.row.id)).hasLink,false);
});
test('link expirado ou inválido tem mesma resposta e entradas inválidas não consultam o banco',async()=>{
  const pool=repository();await assert.rejects(()=>readTracking(pool,'x'),{status:404});assert.equal(pool.calls,0);
  await assert.rejects(()=>issueTracking(pool,pool.row.id,-1,'https://example.com'),{status:400});assert.equal(pool.calls,0);
  const result=await issueTracking(pool,pool.row.id,0,'https://example.com');pool.row.tracking_expires_at=new Date(Date.now()-1000);
  await assert.rejects(()=>readTracking(pool,new URL(result.url).hash.slice(1)),{status:404});assert.equal((await trackingState(pool,pool.row.id)).enabled,false);
  await assert.rejects(()=>readTracking(pool,'a'.repeat(64)),{status:404});
});
