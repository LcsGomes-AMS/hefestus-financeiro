import express from 'express';
import {randomUUID,createHash} from 'node:crypto';
import {HttpError,uuid} from './validation.js';
export const MAX_PROOF_SIZE=5*1024*1024;
export const MAX_ORDER_PROOFS=10;
const columns="id,filename,mime_type,file_size,created_at";
const metadata=row=>({id:row.id,name:row.filename,type:row.mime_type,size:row.file_size,createdAt:new Date(row.created_at).toISOString()});
function validateName(value){
  if(typeof value!=='string'||!value.trim()||value.length>160||/[\x00-\x1f\x7f\\/]/.test(value))throw new HttpError(400,'Nome de arquivo inválido. Use até 160 caracteres.');
  return value.trim();
}
export function validateProof(name,bytes){
  name=validateName(name);
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw new HttpError(400,'Escolha um arquivo para anexar.');
  if(bytes.length>MAX_PROOF_SIZE)throw new HttpError(413,'O arquivo deve ter no máximo 5 MB.');
  let type,extension;
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){type='image/png';extension='png';}
  else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){type='image/jpeg';extension='jpg';}
  else if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){type='image/webp';extension='webp';}
  else if(bytes.length>=5&&bytes.toString('ascii',0,5)==='%PDF-'){type='application/pdf';extension='pdf';}
  else throw new HttpError(400,'Formato não aceito. Envie PDF, JPG, PNG ou WebP. Converta arquivos HEIC para JPG ou PNG.');
  // O tipo é reconhecido pelo conteúdo, sem confiar no nome ou Content-Type enviado.
  const base=name.replace(/\.[^.]*$/,'').trim()||'comprovante';
  return {name:base.slice(0,150)+'.'+extension,type,size:bytes.length,hash:createHash('sha256').update(bytes).digest('hex')};
}
export async function listProofs(pool,orderId){
  uuid(orderId);
  const order=await pool.query('SELECT id FROM hm_orders WHERE id=$1 AND deleted_at IS NULL',[orderId]);
  if(!order.rowCount)throw new HttpError(404,'Pedido não encontrado.');
  const result=await pool.query(`SELECT p.id,p.filename,p.mime_type,p.file_size,p.created_at FROM hm_order_proofs p JOIN hm_orders o ON o.id=p.order_id WHERE p.order_id=$1 AND o.deleted_at IS NULL ORDER BY p.created_at DESC,p.id`,[orderId]);
  return {items:result.rows.map(metadata),maxFiles:MAX_ORDER_PROOFS,maxSize:MAX_PROOF_SIZE};
}
export async function saveProof(pool,orderId,name,bytes,actor){
  uuid(orderId);const file=validateProof(name,bytes),client=await pool.connect();
  try{
    await client.query('BEGIN');
    const order=await client.query('SELECT id FROM hm_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[orderId]);
    if(!order.rowCount)throw new HttpError(404,'Pedido não encontrado.');
    const existing=await client.query(`SELECT ${columns} FROM hm_order_proofs WHERE order_id=$1 AND sha256=$2`,[orderId,file.hash]);
    if(existing.rowCount){await client.query('COMMIT');return {...metadata(existing.rows[0]),duplicate:true};}
    const count=await client.query('SELECT COUNT(*) AS count FROM hm_order_proofs WHERE order_id=$1',[orderId]);
    if(Number(count.rows[0].count)>=MAX_ORDER_PROOFS)throw new HttpError(409,'Este pedido já tem 10 comprovantes. Remova um arquivo antes de anexar outro.');
    const result=await client.query(`INSERT INTO hm_order_proofs(id,order_id,filename,mime_type,file_size,file_data,sha256,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${columns}`,[randomUUID(),orderId,file.name,file.type,file.size,bytes,file.hash,actor]);
    await client.query('COMMIT');return {...metadata(result.rows[0]),duplicate:false};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function readProof(pool,orderId,proofId){
  uuid(orderId);uuid(proofId);
  const result=await pool.query(`SELECT p.filename,p.mime_type,p.file_size,p.file_data FROM hm_order_proofs p JOIN hm_orders o ON o.id=p.order_id WHERE p.id=$1 AND p.order_id=$2 AND o.deleted_at IS NULL`,[proofId,orderId]);
  if(!result.rowCount)throw new HttpError(404,'Comprovante não encontrado.');return result.rows[0];
}
export async function removeProof(pool,orderId,proofId){
  uuid(orderId);uuid(proofId);
  const result=await pool.query('DELETE FROM hm_order_proofs p WHERE p.id=$1 AND p.order_id=$2 AND EXISTS(SELECT 1 FROM hm_orders o WHERE o.id=p.order_id AND o.deleted_at IS NULL) RETURNING p.id',[proofId,orderId]);
  if(!result.rowCount)throw new HttpError(404,'Comprovante não encontrado.');return {ok:true};
}
export function registerPaymentProofs(app,pool,actor){
  // Registre depois da autenticação/CSRF. Arquivos não passam pelo parser JSON global.
  app.get('/api/orders/:id/proofs',async(req,res)=>res.json(await listProofs(pool,req.params.id)));
  app.post('/api/orders/:id/proofs',express.raw({type:()=>true,limit:MAX_PROOF_SIZE}),async(req,res)=>{
    let name;try{name=decodeURIComponent(req.get('x-file-name')||'');}catch{throw new HttpError(400,'Nome de arquivo inválido.');}
    const result=await saveProof(pool,req.params.id,name,req.body,actor);res.status(result.duplicate?200:201).json(result);
  });
  app.get('/api/orders/:id/proofs/:proofId/file',async(req,res)=>{
    const file=await readProof(pool,req.params.id,req.params.proofId),download=req.query.download==='1';
    const encoded=encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
    res.set({'Content-Type':file.mime_type,'Content-Length':String(file.file_size),'Content-Disposition':`${download?'attachment':'inline'}; filename="comprovante.${file.mime_type==='application/pdf'?'pdf':file.mime_type.split('/')[1]}"; filename*=UTF-8''${encoded}`,'Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'});
    res.send(file.file_data);
  });
  app.delete('/api/orders/:id/proofs/:proofId',async(req,res)=>res.json(await removeProof(pool,req.params.id,req.params.proofId)));
}
