import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
import {inject} from './inject.js';

test('página pública abre sem login; gerenciamento exige sessão e CSRF',async()=>{
  const pool={async query(sql,args){
    if(sql.startsWith('SELECT csrf_token'))return{rows:[{csrf_token:'test-csrf'}],rowCount:1};
    if(sql.startsWith('SELECT tracking_version'))return{rows:[{tracking_version:0,has_link:false,enabled:false,tracking_expires_at:null}],rowCount:1};
    if(sql.startsWith('SELECT id,status'))return{rows:[{id:'66177f37-33f2-4b7f-818c-a239bf89c273',status:'acabamento',due_date:null,updated_at:new Date()}],rowCount:1};
    throw new Error('SQL inesperado no teste de rotas');
  }};
  const app=await createApp({pool,user:'admin',password:'uma-senha-de-teste',origin:'http://localhost:3000'});
  const customer=await inject(app,{path:'/acompanhar'});assert.equal(customer.status,200);assert.match(customer.text,/Seu projeto/);assert.equal(customer.headers['cache-control'],'no-store');assert.equal(customer.headers['referrer-policy'],'no-referrer');
  const missing=await inject(app,{path:'/api/public/tracking'});assert.equal(missing.status,404);
  const result=await inject(app,{path:'/api/public/tracking',headers:{'x-tracking-token':'a'.repeat(64)}});assert.equal(result.status,200);assert.equal(result.json().status,'acabamento');assert.deepEqual(Object.keys(result.json()).sort(),['dueDate','reference','status','updatedAt']);
  const path='/api/orders/66177f37-33f2-4b7f-818c-a239bf89c273/tracking';
  assert.equal((await inject(app,{path})).status,401);
  assert.equal((await inject(app,{path,method:'POST',body:{version:0},headers:{origin:'http://localhost:3000'}})).status,401);
  const cookie='hm_session='+'1'.repeat(64);
  assert.equal((await inject(app,{path,method:'POST',body:{version:0},headers:{origin:'http://localhost:3000',cookie}})).status,403);
  assert.equal((await inject(app,{path,headers:{cookie}})).status,200);
  assert.equal((await inject(app,{path,method:'POST',body:{version:0},headers:{origin:'https://outro.example',cookie,'x-csrf-token':'test-csrf'}})).status,403);
});
