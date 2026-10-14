import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {HttpError,uuid} from './validation.js';

const digest=token=>createHash('sha256').update(token).digest('hex');
const tokenFormat=/^[a-f0-9]{64}$/;
const trackingColumns="tracking_version,tracking_token_hash IS NOT NULL AS has_link,tracking_expires_at,tracking_token_hash IS NOT NULL AND tracking_expires_at > NOW() AS enabled";
const state=row=>({version:row.tracking_version,hasLink:row.has_link,enabled:row.enabled===true,expiresAt:row.tracking_expires_at?new Date(row.tracking_expires_at).toISOString():null});
function checkVersion(value){if(!Number.isInteger(value)||value<0)throw new HttpError(400,'Atualize os dados do link antes de continuar.');return value;}

export async function readTracking(pool,token){
  if(typeof token!=='string'||!tokenFormat.test(token))throw new HttpError(404,'Link indisponível. Solicite um novo link à Hefestus Maker.');
  const result=await pool.query("SELECT id,status,to_char(due_date,'YYYY-MM-DD') AS due_date,updated_at FROM hm_orders WHERE tracking_token_hash=$1 AND tracking_expires_at > NOW()",[digest(token)]);
  const row=result.rows[0];
  if(!row)throw new HttpError(404,'Link indisponível. Solicite um novo link à Hefestus Maker.');
  // Lista explícita: nenhum dado do caixa, contato ou descrição interna é retornado.
  return {reference:row.id.slice(0,8).toUpperCase(),status:row.status,dueDate:row.due_date||null,updatedAt:new Date(row.updated_at).toISOString()};
}
export async function trackingState(pool,id){
  const result=await pool.query(`SELECT ${trackingColumns} FROM hm_orders WHERE id=$1`,[uuid(id)]);
  if(!result.rowCount)throw new HttpError(404,'Pedido não encontrado.');return state(result.rows[0]);
}
export async function issueTracking(pool,id,version,origin){
  uuid(id);checkVersion(version);const token=randomBytes(32).toString('hex');
  const result=await pool.query(`UPDATE hm_orders SET tracking_token_hash=$1,tracking_expires_at=NOW()+INTERVAL '90 days',tracking_version=tracking_version+1 WHERE id=$2 AND tracking_version=$3 RETURNING ${trackingColumns}`,[digest(token),id,version]);
  if(!result.rowCount)throw new HttpError(409,'O link foi alterado em outra aba. Feche e abra o acompanhamento novamente.');
  return {...state(result.rows[0]),url:new URL('/acompanhar#'+token,origin).href};
}
export async function revokeTracking(pool,id,version){
  uuid(id);checkVersion(version);
  const result=await pool.query(`UPDATE hm_orders SET tracking_token_hash=NULL,tracking_expires_at=NULL,tracking_version=tracking_version+1 WHERE id=$1 AND tracking_version=$2 RETURNING ${trackingColumns}`,[id,version]);
  if(!result.rowCount)throw new HttpError(409,'O link foi alterado em outra aba. Feche e abra o acompanhamento novamente.');
  return state(result.rows[0]);
}
export function registerPublicTracking(app,pool){
  // Rota pública isolada, registrada antes do login. O token fica no fragmento do link,
  // que não integra a URL HTTP enviada aos logs do servidor.
  app.get('/acompanhar',(req,res)=>{
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'});
    res.sendFile(fileURLToPath(new URL('../public/tracking.html',import.meta.url)));
  });
  const limits=new Map();
  app.get('/api/public/tracking',async(req,res)=>{
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'});
    const now=Date.now(),key=req.ip;
    for(const[k,v]of limits)if(v.reset<=now)limits.delete(k);
    let limit=limits.get(key);
    if(!limit){if(limits.size>=10000)return res.status(503).json({error:'Tente novamente em alguns instantes.'});limit={count:0,reset:now+60000};limits.set(key,limit);}
    if(++limit.count>60){res.set('Retry-After','60');return res.status(429).json({error:'Muitas consultas. Aguarde um minuto e tente novamente.'});}
    res.json(await readTracking(pool,req.get('x-tracking-token')));
  });
}
export function registerAdminTracking(app,pool,origin){
  // Depois da autenticação e do CSRF já usados no financeiro.
  app.get('/api/orders/:id/tracking',async(req,res)=>res.json(await trackingState(pool,req.params.id)));
  app.post('/api/orders/:id/tracking',async(req,res)=>res.json(await issueTracking(pool,req.params.id,req.body?.version,origin)));
  app.delete('/api/orders/:id/tracking',async(req,res)=>res.json(await revokeTracking(pool,req.params.id,req.body?.version)));
}
