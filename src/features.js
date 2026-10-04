import { HttpError, filters, uuid, version, entry, validDate } from './validation.js';
import { buildExcel, buildPDF } from './reports.js';
export const statuses = ['orcamento','aprovado','imprimindo','entregue'];
const orderColumns = "id,description,contact,status,amount_cents,weight_grams,to_char(due_date,'YYYY-MM-DD') AS due_date,version";
const serialize = row => ({id:row.id,description:row.description,contact:row.contact,status:row.status,amount:row.amount_cents==null?'':(BigInt(row.amount_cents)/100n)+'.'+String(BigInt(row.amount_cents)%100n).padStart(2,'0'),weight:row.weight_grams==null?'':String(row.weight_grams),dueDate:row.due_date||'',version:row.version});
export function validateOrder(body) {
  if(!body || !statuses.includes(body.status)) throw new HttpError(400,'Etapa do pedido inválida.');
  if(body.dueDate && !validDate(body.dueDate)) throw new HttpError(400,'Prazo inválido.');
  const data=entry({...body,type:'entrada',date:'2026-01-01',amount:body.amount===''?'0.01':body.amount});
  return {...data,status:body.status,amount:body.amount===''?null:data.amount,due:body.dueDate||null};
}
export function registerFeatures(app,pool) {
  // Estas rotas são registradas após a autenticação e a proteção CSRF.
  app.get('/api/monthly',async(req,res)=>{
    const year=Number(req.query.year);
    if(!Number.isInteger(year)||year<2000||year>2100)throw new HttpError(400,'Escolha um ano entre 2000 e 2100.');
    const result=await pool.query("SELECT EXTRACT(MONTH FROM entry_date)::int AS month, COALESCE(SUM(amount_cents) FILTER(WHERE type='entrada'),0) AS incoming, COALESCE(SUM(amount_cents) FILTER(WHERE type='saida'),0) AS outgoing FROM hm_entries WHERE deleted_at IS NULL AND entry_date >= $1::date AND entry_date < $2::date GROUP BY 1 ORDER BY 1",[`${year}-01-01`,`${year+1}-01-01`]);
    res.json({year,months:Array.from({length:12},(_,i)=>{const r=result.rows.find(r=>r.month===i+1);const incoming=String(r?.incoming||0),outgoing=String(r?.outgoing||0);return{month:i+1,incoming,outgoing,balance:String(BigInt(incoming)-BigInt(outgoing))};})});
  });
  app.get('/api/reports/:format',async(req,res)=>{
    const format=req.params.format;
    if(!['xlsx','pdf'].includes(format))throw new HttpError(400,'Formato de relatório inválido.');
    const {where,values}=filters(req.query);
    const result=await pool.query(`SELECT to_char(entry_date,'YYYY-MM-DD') AS date,type,description,contact,weight_grams,amount_cents FROM hm_entries WHERE ${where} ORDER BY entry_date DESC,created_at DESC,id LIMIT 5001`,values);
    if(result.rows.length>5000)throw new HttpError(400,'O relatório excede 5.000 registros. Reduza o período ou aplique mais filtros.');
    const rows=result.rows;
    const meta={from:req.query.from||'',to:req.query.to||'',type:req.query.type||'',search:req.query.search||'',generated:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
    const file= format==='xlsx'?await buildExcel(rows,meta):await buildPDF(rows,meta);
    res.set('Content-Type',format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf');
    res.set('Content-Disposition',`attachment; filename="hefestus-lancamentos.${format}"`);res.send(Buffer.from(file));
  });
  app.get('/api/orders',async(req,res)=>{
    const search=req.query.search||'',status=req.query.status||'',page=Number(req.query.page||1);
    if(typeof search!=='string'||search.length>160||(status&&!statuses.includes(status))||!Number.isInteger(page)||page<1||page>100000)throw new HttpError(400,'Filtros de pedidos inválidos.');
    const args=[],conditions=['TRUE'];
    if(search.trim()){args.push('%'+search.trim().replace(/[\\%_]/g,'\\$&')+'%');conditions.push(`(description ILIKE $${args.length} OR contact ILIKE $${args.length})`);}
    if(status){args.push(status);conditions.push(`status=$${args.length}`);}
    const where=conditions.join(' AND '), client=await pool.connect();
    try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const count=await client.query(`SELECT COUNT(*) AS total FROM hm_orders WHERE ${where}`,args);
      const result=await client.query(`SELECT ${orderColumns} FROM hm_orders WHERE ${where} ORDER BY created_at DESC,id LIMIT 40 OFFSET $${args.length+1}`,[...args,(page-1)*40]);
      await client.query('COMMIT');res.json({items:result.rows.map(serialize),total:Number(count.rows[0].total),page});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.post('/api/orders',async(req,res)=>{
    const id=uuid(req.body?.id),data=validateOrder(req.body);
    const result=await pool.query(`INSERT INTO hm_orders(id,description,contact,status,amount_cents,weight_grams,due_date) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING ${orderColumns}`,[id,data.description,data.contact,data.status,data.amount,data.weight,data.due]);
    if(!result.rowCount){
      const existing=await pool.query(`SELECT ${orderColumns} FROM hm_orders WHERE id=$1`,[id]);const row=existing.rows[0];
      if(!row||row.description!==data.description||row.contact!==data.contact||row.status!==data.status||String(row.amount_cents)!==String(data.amount)||Number(row.weight_grams)!==Number(data.weight)||(row.due_date||null)!==data.due)throw new HttpError(409,'Pedido já registrado. Atualize o quadro antes de continuar.');
      return res.json(serialize(row));
    }
    res.status(201).json(serialize(result.rows[0]));
  });
  app.put('/api/orders/:id',async(req,res)=>{
    const id=uuid(req.params.id),data=validateOrder(req.body),v=version(req.body?.version);
    const result=await pool.query(`UPDATE hm_orders SET description=$1,contact=$2,status=$3,amount_cents=$4,weight_grams=$5,due_date=$6,version=version+1,updated_at=NOW() WHERE id=$7 AND version=$8 RETURNING ${orderColumns}`,[data.description,data.contact,data.status,data.amount,data.weight,data.due,id,v]);
    if(!result.rowCount)throw new HttpError(409,'Pedido alterado em outra aba. Atualize o quadro e tente novamente.');
    res.json(serialize(result.rows[0]));
  });
}
