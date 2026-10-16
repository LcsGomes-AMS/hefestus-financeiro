// Banco substituto para verificar transações e isolamento sem conexão ao Neon.
// Consultas financeiras são recusadas: anexos não podem movimentar o caixa.
export const orderId='66177f37-33f2-4b7f-818c-a239bf89c273';
export const otherOrderId='76177f37-33f2-4b7f-818c-a239bf89c273';
export function proofRepository(){
  let proofs=new Map(),queue=Promise.resolve();
  const pool={orders:new Map([[orderId,{id:orderId,deleted_at:null}],[otherOrderId,{id:otherOrderId,deleted_at:null}]]),get proofs(){return proofs;},queries:[],failCommit:false,query:execute,async connect(){
    let snapshot,unlock;
    return{async query(sql,args){
      if(sql==='BEGIN'){const prior=queue;queue=new Promise(resolve=>unlock=resolve);await prior;snapshot=new Map(proofs);return result([]);}
      if(sql==='COMMIT'){if(pool.failCommit)throw Error('Falha simulada no commit');snapshot=null;return result([]);}
      if(sql==='ROLLBACK'){if(snapshot)proofs=snapshot;return result([]);}
      return execute(sql,args);
    },release(){unlock?.();}};
  }};
  const result=rows=>({rows,rowCount:rows.length});
  const active=id=>pool.orders.has(id)&&!pool.orders.get(id).deleted_at;
  async function execute(sql,args=[]){
    pool.queries.push(sql);
    if(sql.startsWith('SELECT csrf_token'))return result([{csrf_token:'test-csrf'}]);
    if(sql.startsWith('SELECT id FROM hm_orders'))return result(active(args[0])?[{id:args[0]}]:[]);
    if(sql.startsWith('SELECT p.id,p.filename'))return result(active(args[0])?[...proofs.values()].filter(p=>p.order_id===args[0]).sort((a,b)=>b.created_at-a.created_at):[]);
    if(sql.startsWith('SELECT id,filename'))return result([...proofs.values()].filter(p=>p.order_id===args[0]&&p.sha256===args[1]));
    if(sql.startsWith('SELECT COUNT(*) AS count FROM hm_order_proofs'))return result([{count:[...proofs.values()].filter(p=>p.order_id===args[0]).length}]);
    if(sql.startsWith('INSERT INTO hm_order_proofs')){
      const [id,order_id,filename,mime_type,file_size,file_data,sha256,created_by]=args;
      const proof={id,order_id,filename,mime_type,file_size,file_data:Buffer.from(file_data),sha256,created_by,created_at:new Date()};proofs.set(id,proof);return result([proof]);
    }
    if(sql.startsWith('SELECT p.filename')||sql.startsWith('DELETE FROM hm_order_proofs')){
      const proof=proofs.get(args[0]);if(!proof||proof.order_id!==args[1]||!active(args[1]))return result([]);
      if(sql.startsWith('DELETE'))proofs.delete(proof.id);return result([proof]);
    }
    throw Error('Consulta inesperada no repositório de comprovantes: '+sql);
  }
  return pool;
}
