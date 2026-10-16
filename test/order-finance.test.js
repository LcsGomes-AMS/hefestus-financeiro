import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrder,updateOrder} from '../src/order-finance.js';
import {deleteOrder} from '../src/orders.js';
import {validateOrder} from '../src/features.js';
import {createApp} from '../src/app.js';
import {inject} from './inject.js';
import {deliveryRepository} from './delivery-repository.js';
const id='66177f37-33f2-4b7f-818c-a239bf89c273';
const payload=(status='imprimindo',amount='120,00')=>({status,amount,description:'Hogwarts Wizard World',contact:'Lucas',weight:'300',dueDate:'2026-10-19'});
const data=(status,amount)=>validateOrder(payload(status,amount));

test('entregar registra R$ 120,00 em centavos, com cliente, peso, categoria e auditoria',async()=>{
  const pool=deliveryRepository();await createOrder(pool,id,data('imprimindo'),'admin');assert.equal(pool.state.entries.size,0);
  const delivered=await updateOrder(pool,id,1,data('entregue'),'admin');assert.equal(delivered.creditCreated,true);assert.equal(delivered.financialEntry.amountCents,'12000');
  const e=[...pool.state.entries.values()][0];assert.equal(e.type,'entrada');assert.equal(e.order_id,id);assert.equal(e.description,'Hogwarts Wizard World');assert.equal(e.contact,'Lucas');assert.equal(e.weight_grams,'300');assert.equal(e.category,'Impressão 3D');
  assert.equal(pool.state.audits.length,1);assert.equal(pool.state.audits[0].snapshot.orderId,id);assert.ok(pool.queries.some(q=>q.includes("CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'")));
});
test('reenvios, entregas concorrentes e voltar/avançar etapa não duplicam receita',async()=>{
  const pool=deliveryRepository();await createOrder(pool,id,data('imprimindo'),'admin');
  const results=await Promise.allSettled([updateOrder(pool,id,1,data('entregue'),'admin'),updateOrder(pool,id,1,data('entregue'),'admin')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  await updateOrder(pool,id,2,data('imprimindo'),'admin');const again=await updateOrder(pool,id,3,data('entregue'),'admin');assert.equal(again.creditCreated,false);assert.equal(pool.state.entries.size,1);assert.equal(pool.state.audits.length,1);
});
test('erro na receita/auditoria desfaz também a mudança de etapa',async()=>{
  const pool=deliveryRepository();await createOrder(pool,id,data('imprimindo'),'admin');pool.failAudit=true;
  await assert.rejects(()=>updateOrder(pool,id,1,data('entregue'),'admin'),/Falha simulada/);assert.equal(pool.state.orders.get(id).status,'imprimindo');assert.equal(pool.state.orders.get(id).version,1);assert.equal(pool.state.entries.size,0);
  pool.failAudit=false;assert.equal((await updateOrder(pool,id,1,data('entregue'),'admin')).creditCreated,true);
});
test('criação já entregue é atômica e idempotente',async()=>{
  const pool=deliveryRepository();const first=await createOrder(pool,id,data('entregue'),'admin');const retry=await createOrder(pool,id,data('entregue'),'admin');assert.equal(first.creditCreated,true);assert.equal(retry.creditCreated,false);assert.equal(pool.state.entries.size,1);
  const failing=deliveryRepository();failing.failAudit=true;await assert.rejects(()=>createOrder(failing,id,data('entregue'),'admin'));assert.equal(failing.state.orders.size,0);assert.equal(failing.state.entries.size,0);
});
test('entregue exige valor; registros antigos não têm lançamento retroativo',async()=>{
  assert.throws(()=>data('entregue',''),{status:400});const pool=deliveryRepository();await createOrder(pool,id,data('imprimindo'),'admin');pool.state.orders.get(id).status='entregue';
  await updateOrder(pool,id,1,data('entregue'),'admin');assert.equal(pool.state.entries.size,0);
});
test('editar/excluir pedido não modifica receita; receita excluída não reaparece',async()=>{
  const pool=deliveryRepository();await createOrder(pool,id,data('entregue'),'admin');await updateOrder(pool,id,1,data('entregue','150,00'),'admin');const e=[...pool.state.entries.values()][0];assert.equal(e.amount_cents,12000);
  e.deleted_at=new Date();await updateOrder(pool,id,2,data('imprimindo','150,00'),'admin');const again=await updateOrder(pool,id,3,data('entregue','150,00'),'admin');assert.equal(again.creditCreated,false);assert.equal(again.financialEntry.deleted,true);assert.equal(pool.state.entries.size,1);
  await deleteOrder(pool,id,4);assert.equal(pool.state.entries.size,1);
});
test('API integra botão/edição com lançamento e total financeiro',async()=>{
  const pool=deliveryRepository(),app=await createApp({pool,user:'admin',password:'senha-de-teste-123',origin:'http://localhost:3000'});
  const headers={origin:'http://localhost:3000',cookie:'hm_session='+'1'.repeat(64),'x-csrf-token':'test-csrf'};
  assert.equal((await inject(app,{path:'/api/orders',method:'POST',body:{id,...payload()},headers})).status,201);
  const changed=await inject(app,{path:'/api/orders/'+id,method:'PUT',body:{version:1,...payload('entregue')},headers});assert.equal(changed.status,200);assert.equal(changed.json().creditCreated,true);
  const ledger=await inject(app,{path:'/api/entries',headers});assert.equal(ledger.status,200);assert.equal(ledger.json().summary.balance,'12000');assert.equal(ledger.json().items[0].orderId,id);
});
