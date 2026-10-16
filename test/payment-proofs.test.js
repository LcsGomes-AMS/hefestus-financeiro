import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_PROOF_SIZE,validateProof,saveProof,listProofs,readProof,removeProof} from '../src/payment-proofs.js';
import {createApp} from '../src/app.js';
import {inject} from './inject.js';
import {proofRepository,orderId,otherOrderId} from './proof-repository.js';
const pdf=Buffer.from('%PDF-1.7\nconteudo-de-teste');
const headers={origin:'http://localhost:3000',cookie:'hm_session='+'1'.repeat(64),'x-csrf-token':'test-csrf','x-file-name':encodeURIComponent('Comprovante João.pdf')};
const appFor=pool=>createApp({pool,user:'admin',password:'senha-de-teste-123',origin:'http://localhost:3000'});
const path='/api/orders/'+orderId+'/proofs';

test('reconhece PDF, PNG, JPG e WebP pelo conteúdo e normaliza extensão',()=>{
  for(const [bytes,type,extension] of [[pdf,'application/pdf','pdf'],[Buffer.from([137,80,78,71,13,10,26,10]),'image/png','png'],[Buffer.from([255,216,255,224]),'image/jpeg','jpg'],[Buffer.from('RIFF0000WEBP'),'image/webp','webp']]){
    const file=validateProof('Pagamento.exe',bytes);assert.equal(file.type,type);assert.equal(file.name,'Pagamento.'+extension);assert.equal(file.size,bytes.length);assert.equal(file.hash.length,64);
  }
});
test('recusa arquivo vazio, HTML disfarçado, formato não aceito, nome inválido e mais de 5 MB',()=>{
  for(const bytes of [Buffer.alloc(0),Buffer.from('<script>alert(1)</script>'),Buffer.from('heic')])assert.throws(()=>validateProof('pagamento.pdf',bytes),{status:400});
  for(const name of ['',null,'a/b.pdf','a\\b.pdf','a\r\n.pdf','x'.repeat(161)])assert.throws(()=>validateProof(name,pdf),{status:400});
  assert.throws(()=>validateProof('pagamento.pdf',Buffer.alloc(MAX_PROOF_SIZE+1)),{status:413});
  assert.equal(validateProof('limite.pdf',Buffer.concat([pdf,Buffer.alloc(MAX_PROOF_SIZE-pdf.length)])).size,MAX_PROOF_SIZE);
});
test('salva bytes e metadados no pedido; reenvios concorrentes não duplicam arquivo',async()=>{
  const pool=proofRepository();const results=await Promise.all([saveProof(pool,orderId,'João.pdf',pdf,'admin'),saveProof(pool,orderId,'outro-nome.pdf',pdf,'admin')]);
  assert.equal(pool.proofs.size,1);assert.equal(results[0].id,results[1].id);assert.equal(results[0].duplicate,false);assert.equal(results[1].duplicate,true);
  const data=await listProofs(pool,orderId);assert.equal(data.items[0].name,'João.pdf');assert.equal(data.maxFiles,10);assert.equal(data.items[0].file_data,undefined);
  assert.deepEqual((await readProof(pool,orderId,results[0].id)).file_data,pdf);assert.equal([...pool.proofs.values()][0].created_by,'admin');
  await saveProof(pool,otherOrderId,'Mesmo arquivo.pdf',pdf,'admin');assert.equal(pool.proofs.size,2);
  assert.ok(!pool.queries.some(q=>q.includes('hm_entries')));
});
test('limite de 10 por pedido resiste a envios concorrentes e permite reenvio já salvo',async()=>{
  const pool=proofRepository();for(let i=0;i<9;i++)await saveProof(pool,orderId,'p.pdf',Buffer.concat([pdf,Buffer.from(String(i))]),'admin');
  const results=await Promise.allSettled([saveProof(pool,orderId,'a.pdf',pdf,'admin'),saveProof(pool,orderId,'b.pdf',Buffer.concat([pdf,Buffer.from('b')]),'admin')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal(pool.proofs.size,10);
  assert.equal((await saveProof(pool,orderId,'reenvio.pdf',pdf,'admin')).duplicate,true);
});
test('falha transacional não deixa anexo parcial; pedido ausente/excluído é bloqueado',async()=>{
  const pool=proofRepository();pool.failCommit=true;await assert.rejects(()=>saveProof(pool,orderId,'p.pdf',pdf,'admin'),/Falha simulada/);assert.equal(pool.proofs.size,0);
  pool.failCommit=false;pool.orders.get(orderId).deleted_at=new Date();await assert.rejects(()=>saveProof(pool,orderId,'p.pdf',pdf,'admin'),{status:404});await assert.rejects(()=>listProofs(pool,orderId),{status:404});
  await assert.rejects(()=>saveProof(pool,'86177f37-33f2-4b7f-818c-a239bf89c273','p.pdf',pdf,'admin'),{status:404});
});
test('não permite ler ou remover anexo pelo pedido errado; exclusão de arquivo não afeta caixa',async()=>{
  const pool=proofRepository(),file=await saveProof(pool,orderId,'p.pdf',pdf,'admin');
  await assert.rejects(()=>readProof(pool,otherOrderId,file.id),{status:404});await assert.rejects(()=>removeProof(pool,otherOrderId,file.id),{status:404});assert.equal(pool.proofs.size,1);
  pool.orders.get(orderId).deleted_at=new Date();await assert.rejects(()=>readProof(pool,orderId,file.id),{status:404});await assert.rejects(()=>removeProof(pool,orderId,file.id),{status:404});
  pool.orders.get(orderId).deleted_at=null;assert.deepEqual(await removeProof(pool,orderId,file.id),{ok:true});assert.equal(pool.proofs.size,0);await assert.rejects(()=>readProof(pool,orderId,file.id),{status:404});
  assert.ok(!pool.queries.some(q=>q.includes('hm_entries')));
});
test('API protege envio/listagem/arquivo/exclusão com sessão, origem e CSRF',async()=>{
  const pool=proofRepository(),app=await appFor(pool);
  assert.equal((await inject(app,{path})).status,401);
  assert.equal((await inject(app,{path,method:'POST',body:pdf,headers:{origin:headers.origin,'x-file-name':'p.pdf'}})).status,401);
  assert.equal((await inject(app,{path,method:'POST',body:pdf,headers:{...headers,'x-csrf-token':'errado'}})).status,403);
  assert.equal((await inject(app,{path,method:'POST',body:pdf,headers:{...headers,origin:'https://outro.test'}})).status,403);assert.equal(pool.proofs.size,0);
  const saved=await inject(app,{path,method:'POST',body:pdf,headers});assert.equal(saved.status,201);const id=saved.json().id;
  assert.equal((await inject(app,{path:path+'/'+id+'/file'})).status,401);
  assert.equal((await inject(app,{path:path+'/'+id,method:'DELETE',headers:{...headers,'x-csrf-token':''}})).status,403);assert.equal(pool.proofs.size,1);
  assert.equal((await inject(app,{path:path+'/'+id,method:'DELETE',headers})).status,200);
});
test('API recebe binário acima do limite JSON, preserva bytes e entrega download privado',async()=>{
  const pool=proofRepository(),app=await appFor(pool),large=Buffer.concat([pdf,Buffer.alloc(100*1024,3)]);
  const saved=await inject(app,{path,method:'POST',body:large,headers});assert.equal(saved.status,201);assert.equal(saved.json().name,'Comprovante João.pdf');
  const duplicate=await inject(app,{path,method:'POST',body:large,headers});assert.equal(duplicate.status,200);assert.equal(duplicate.json().duplicate,true);
  const list=await inject(app,{path,headers});assert.equal(list.json().items.length,1);assert.equal(list.json().items[0].size,large.length);
  const file=await inject(app,{path:path+'/'+saved.json().id+'/file?download=1',headers});assert.equal(file.status,200);assert.deepEqual(file.body,large);assert.equal(file.headers['content-type'],'application/pdf');assert.match(file.headers['content-disposition'],/^attachment;.*Jo%C3%A3o/);assert.equal(file.headers['cache-control'],'no-store');assert.equal(file.headers['x-content-type-options'],'nosniff');assert.match(file.headers['content-security-policy'],/^sandbox;/);
  assert.equal((await inject(app,{path,method:'POST',body:Buffer.alloc(MAX_PROOF_SIZE+1),headers})).status,413);
  assert.equal((await inject(app,{path,method:'POST',body:pdf,headers:{...headers,'x-file-name':'%zz'}})).status,400);
  assert.equal(pool.proofs.size,1);
});
