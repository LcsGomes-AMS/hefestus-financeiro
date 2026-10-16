import {randomUUID} from 'node:crypto';
import {HttpError,uuid,version} from './validation.js';

export const orderColumns="id,description,contact,status,amount_cents,weight_grams,to_char(due_date,'YYYY-MM-DD') AS due_date,version,(SELECT json_build_object('id',e.id,'amountCents',e.amount_cents::text,'type',e.type,'deleted',e.deleted_at IS NOT NULL) FROM hm_entries e WHERE e.order_id=hm_orders.id) AS financial_entry";
export const serializeOrder=row=>({id:row.id,description:row.description,contact:row.contact,status:row.status,amount:row.amount_cents==null?'':(BigInt(row.amount_cents)/100n)+'.'+String(BigInt(row.amount_cents)%100n).padStart(2,'0'),weight:row.weight_grams==null?'':String(row.weight_grams),dueDate:row.due_date||'',version:row.version,financialEntry:row.financial_entry||null});
const entryColumns="id,type,to_char(entry_date,'YYYY-MM-DD') AS date,amount_cents,description,contact,weight_grams,category,version,order_id";

async function creditDelivery(client,id,data,actor){
  if(data.amount==null)throw new HttpError(400,'Informe o valor do pedido antes de marcar como entregue.');
  const result=await client.query(`INSERT INTO hm_entries(id,type,entry_date,amount_cents,description,contact,weight_grams,category,order_id)
    VALUES($1,'entrada',(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,$2,$3,$4,$5,'Impressão 3D',$6)
    ON CONFLICT(order_id) DO NOTHING RETURNING ${entryColumns}`,[randomUUID(),data.amount,data.description,data.contact,data.weight,id]);
  // A unicidade abrange também lançamentos excluídos: entregar novamente não recria a receita.
  if(!result.rowCount)return false;
  const row=result.rows[0];
  const snapshot={id:row.id,type:row.type,date:row.date,amountCents:String(row.amount_cents),description:row.description,contact:row.contact,weight:row.weight_grams==null?'':String(row.weight_grams),category:row.category,version:row.version,orderId:id,source:'order-delivery'};
  await client.query('INSERT INTO hm_audit(entry_id,action,actor,snapshot) VALUES($1,$2,$3,$4::jsonb)',[row.id,'create',actor,JSON.stringify(snapshot)]);
  return true;
}
async function currentOrder(client,id){
  const result=await client.query(`SELECT ${orderColumns},deleted_at FROM hm_orders WHERE id=$1`,[id]);return result.rows[0];
}
async function transaction(pool,work){
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
export async function createOrder(pool,id,data,actor){
  uuid(id);
  return transaction(pool,async client=>{
    const result=await client.query('INSERT INTO hm_orders(id,description,contact,status,amount_cents,weight_grams,due_date) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id',[id,data.description,data.contact,data.status,data.amount,data.weight,data.due]);
    if(!result.rowCount){
      const row=await currentOrder(client,id);
      if(!row||row.deleted_at||row.description!==data.description||row.contact!==data.contact||row.status!==data.status||String(row.amount_cents)!==String(data.amount)||Number(row.weight_grams)!==Number(data.weight)||(row.due_date||null)!==data.due)throw new HttpError(409,'Pedido já registrado. Atualize o quadro antes de continuar.');
      return{...serializeOrder(row),creditCreated:false};
    }
    const creditCreated=data.status==='entregue'?await creditDelivery(client,id,data,actor):false;
    return{...serializeOrder(await currentOrder(client,id)),creditCreated};
  });
}
export async function updateOrder(pool,id,expectedVersion,data,actor){
  uuid(id);version(expectedVersion);
  return transaction(pool,async client=>{
    // O bloqueio por pedido serializa entregas concorrentes; caixa, auditoria e etapa
    // são confirmados juntos, ou todos são desfeitos em caso de erro.
    const previous=await client.query('SELECT id,status,version,deleted_at FROM hm_orders WHERE id=$1 FOR UPDATE',[id]);
    const old=previous.rows[0];
    if(!old||old.deleted_at||old.version!==expectedVersion)throw new HttpError(409,'Pedido alterado ou excluído em outra aba. Atualize o quadro e tente novamente.');
    const result=await client.query('UPDATE hm_orders SET description=$1,contact=$2,status=$3,amount_cents=$4,weight_grams=$5,due_date=$6,version=version+1,updated_at=NOW() WHERE id=$7 AND version=$8 AND deleted_at IS NULL RETURNING id',[data.description,data.contact,data.status,data.amount,data.weight,data.due,id,expectedVersion]);
    if(!result.rowCount)throw new HttpError(409,'Pedido alterado em outra aba. Atualize o quadro.');
    const creditCreated=data.status==='entregue'&&old.status!=='entregue'?await creditDelivery(client,id,data,actor):false;
    return{...serializeOrder(await currentOrder(client,id)),creditCreated};
  });
}
