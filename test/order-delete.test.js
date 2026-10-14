import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deleteOrder} from '../src/orders.js';
import {createApp} from '../src/app.js';
import {inject} from './inject.js';

function repository(){
  const token='b'.repeat(64),row={id:'66177f37-33f2-4b7f-818c-a239bf89c273',description:'Peça de teste',contact:'Cliente',status:'imprimindo',amount_cents:'8000',weight_grams:'200.00',due_date:'2026-10-23',version:1,tracking_version:1,tracking_token_hash:createHash('sha256').update(token).digest('hex'),tracking_expires_at:new Date(Date.now()+86400000),updated_at:new Date(),deleted_at:null},queries=[];
  const pool={row,token,queries,async connect(){return{query:pool.query,release(){}};},async query(sql,args=[]){
    queries.push(sql);
    if(sql.startsWith('SELECT csrf_token'))return{rows:[{csrf_token:'csrf-test'}],rowCount:1};
    if(sql.startsWith('UPDATE hm_orders SET deleted_at')){
      if(row.id!==args[0]||row.version!==args[1]||row.deleted_at)return{rows:[],rowCount:0};
      row.deleted_at=new Date();row.version++;row.tracking_version++;row.tracking_token_hash=null;row.tracking_expires_at=null;return{rows:[{id:row.id}],rowCount:1};
    }
    if(sql.startsWith('SELECT id,status'))return{rows:!row.deleted_at&&row.tracking_token_hash===args[0]?[row]:[],rowCount:!row.deleted_at&&row.tracking_token_hash===args[0]?1:0};
    if(sql.startsWith('UPDATE hm_orders SET tracking_token_hash')||sql.startsWith('UPDATE hm_orders SET description'))return{rows:[],rowCount:0};
    if(sql.startsWith('SELECT tracking_version'))return{rows:[],rowCount:0};
    if(sql.startsWith('SELECT COUNT(*) AS total')){assert.match(sql,/deleted_at IS NULL/);return{rows:[{total:row.deleted_at?'0':'1'}],rowCount:1};}
    if(sql.startsWith('SELECT id,description')){assert.match(sql,/deleted_at IS NULL/);return{rows:row.deleted_at?[]:[row],rowCount:row.deleted_at?0:1};}
    if(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','COMMIT','ROLLBACK'].includes(sql))return{rows:[],rowCount:0};
    throw Error('SQL não previsto no repositório de teste: '+sql);
  }};return pool;
}

test('exclusão lógica é atômica, invalida o link e preserva os dados do pedido',async()=>{
  const pool=repository();await assert.rejects(()=>deleteOrder(pool,pool.row.id,2),{status:409});assert.equal(pool.row.deleted_at,null);assert.ok(pool.row.tracking_token_hash);
  const result=await deleteOrder(pool,pool.row.id,1);assert.deepEqual(result,{ok:true});assert.ok(pool.row.deleted_at);assert.equal(pool.row.tracking_token_hash,null);assert.equal(pool.row.tracking_expires_at,null);assert.equal(pool.row.description,'Peça de teste');assert.equal(pool.row.amount_cents,'8000');assert.equal(pool.row.version,2);assert.equal(pool.row.tracking_version,2);
  assert.match(pool.queries.at(-1),/WHERE id=\$1 AND version=\$2 AND deleted_at IS NULL/);
  await assert.rejects(()=>deleteOrder(pool,pool.row.id,1),{status:409});assert.ok(pool.queries.every(sql=>!sql.includes('hm_entries')));
});
test('identificador e versão são obrigatórios antes de acessar o banco',async()=>{
  const pool=repository();await assert.rejects(()=>deleteOrder(pool,'inválido',1),{status:400});await assert.rejects(()=>deleteOrder(pool,pool.row.id,0),{status:400});assert.equal(pool.queries.length,0);
});
test('API exige sessão e CSRF e impede edição, consulta e renovação após exclusão',async()=>{
  const pool=repository(),app=await createApp({pool,user:'admin',password:'senha-de-teste-123',origin:'http://localhost:3000'}),path='/api/orders/'+pool.row.id;
  const headers={origin:'http://localhost:3000',cookie:'hm_session='+'1'.repeat(64),'x-csrf-token':'csrf-test'};
  assert.equal((await inject(app,{path,method:'DELETE',body:{version:1},headers:{origin:headers.origin}})).status,401);
  assert.equal((await inject(app,{path,method:'DELETE',body:{version:1},headers:{origin:headers.origin,cookie:headers.cookie}})).status,403);
  assert.equal(pool.row.deleted_at,null);
  assert.equal((await inject(app,{path:'/api/public/tracking',headers:{'x-tracking-token':pool.token}})).status,200);
  assert.equal((await inject(app,{path,method:'DELETE',body:{version:2},headers})).status,409);
  assert.equal((await inject(app,{path,method:'DELETE',body:{version:1},headers})).status,200);
  const listed=await inject(app,{path:'/api/orders',headers});assert.equal(listed.status,200);assert.deepEqual(listed.json().items,[]);assert.equal(listed.json().total,0);
  assert.equal((await inject(app,{path:'/api/public/tracking',headers:{'x-tracking-token':pool.token}})).status,404);
  assert.equal((await inject(app,{path:path+'/tracking',headers})).status,404);
  assert.equal((await inject(app,{path:path+'/tracking',method:'POST',body:{version:2},headers})).status,409);
  const body={description:'Tentativa',contact:'',amount:'80.00',weight:'',dueDate:'',status:'entregue',version:2};assert.equal((await inject(app,{path,method:'PUT',body,headers})).status,409);
  assert.ok(pool.queries.filter(sql=>sql.startsWith('UPDATE hm_orders')).every(sql=>sql.includes('deleted_at IS NULL')));
});
