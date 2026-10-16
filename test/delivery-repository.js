// Repositório transacional em memória para testar o serviço sem um Neon real.
// Reconhece as operações usadas pelo serviço; não é um interpretador PostgreSQL.
export function deliveryRepository(){
  let state={orders:new Map(),entries:new Map(),audits:[]},queue=Promise.resolve();
  const pool={get state(){return state;},failAudit:false,queries:[],query:(sql,args)=>execute(sql,args),async connect(){
    let snapshot,unlock;
    return{async query(sql,args){
      if(sql.startsWith('BEGIN')){let release;const prior=queue;queue=new Promise(r=>release=r);await prior;unlock=release;snapshot=structuredClone(state);return{rows:[],rowCount:0};}
      if(sql==='COMMIT'){snapshot=null;return{rows:[],rowCount:0};}
      if(sql==='ROLLBACK'){if(snapshot)state=snapshot;snapshot=null;return{rows:[],rowCount:0};}
      return execute(sql,args);
    },release(){if(unlock){unlock();unlock=null;}}};
  }};
  function result(rows){return{rows:structuredClone(rows),rowCount:rows.length};}
  function withFinance(order){if(!order)return null;const e=[...state.entries.values()].find(e=>e.order_id===order.id);return{...order,financial_entry:e?{id:e.id,amountCents:String(e.amount_cents),type:e.type,deleted:!!e.deleted_at}:null};}
  async function execute(sql,args=[]){
    pool.queries.push(sql);
    if(sql.startsWith('SELECT csrf_token'))return result([{csrf_token:'test-csrf'}]);
    if(sql.startsWith('INSERT INTO hm_orders')){
      if(state.orders.has(args[0]))return result([]);
      state.orders.set(args[0],{id:args[0],description:args[1],contact:args[2],status:args[3],amount_cents:args[4],weight_grams:args[5],due_date:args[6],version:1,deleted_at:null});return result([{id:args[0]}]);
    }
    if(sql.startsWith('SELECT id,status,version,deleted_at')){const row=state.orders.get(args[0]);return result(row?[row]:[]);}
    if(sql.startsWith('UPDATE hm_orders SET description')){
      const row=state.orders.get(args[6]);if(!row||row.deleted_at||row.version!==args[7])return result([]);
      Object.assign(row,{description:args[0],contact:args[1],status:args[2],amount_cents:args[3],weight_grams:args[4],due_date:args[5],version:row.version+1});return result([{id:row.id}]);
    }
    if(sql.startsWith('INSERT INTO hm_entries')){
      if([...state.entries.values()].some(e=>e.order_id===args[5]))return result([]);
      const row={id:args[0],type:'entrada',date:'2026-10-16',amount_cents:args[1],description:args[2],contact:args[3],weight_grams:args[4],category:'Impressão 3D',order_id:args[5],version:1,deleted_at:null};state.entries.set(row.id,row);return result([row]);
    }
    if(sql.startsWith('INSERT INTO hm_audit')){if(pool.failAudit)throw Error('Falha simulada na auditoria');state.audits.push({entryId:args[0],action:args[1],actor:args[2],snapshot:JSON.parse(args[3])});return result([]);}
    if(sql.startsWith('SELECT COUNT(*) AS total'))return result([{total:[...state.orders.values()].filter(o=>!o.deleted_at).length}]);
    if(sql.startsWith('SELECT id,description')){
      if(sql.includes('WHERE id=$1')){const row=withFinance(state.orders.get(args[0]));return result(row?[row]:[]);}
      return result([...state.orders.values()].filter(o=>!o.deleted_at).map(withFinance));
    }
    if(sql.startsWith('SELECT COUNT(*) AS count')){const rows=[...state.entries.values()].filter(e=>!e.deleted_at);return result([{count:rows.length,incoming:rows.filter(e=>e.type==='entrada').reduce((sum,e)=>sum+BigInt(e.amount_cents),0n).toString(),outgoing:'0'}]);}
    if(sql.startsWith('SELECT EXTRACT(MONTH')){const entries=[...state.entries.values()].filter(e=>!e.deleted_at);return result(entries.length?[{month:10,incoming:entries.reduce((s,e)=>s+BigInt(e.amount_cents),0n).toString(),outgoing:'0'}]:[]);}
    if(sql.startsWith("SELECT id,type,to_char(entry_date"))return result([...state.entries.values()].filter(e=>!e.deleted_at));
    if(sql.startsWith('UPDATE hm_orders SET deleted_at')){const row=state.orders.get(args[0]);if(!row||row.deleted_at||row.version!==args[1])return result([]);row.deleted_at=new Date();row.version++;return result([{id:row.id}]);}
    throw Error('Consulta não prevista no teste: '+sql);
  }
  return pool;
}
