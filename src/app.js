import express from 'express';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { HttpError, entry, filters, uuid, version } from './validation.js';
import { registerFeatures } from './features.js';
const scrypt = promisify(scryptCallback);
const hash = text => createHash('sha256').update(text).digest('hex');
const serial = row => ({ id:row.id, type:row.type, date:row.date, amountCents:String(row.amount_cents), description:row.description, contact:row.contact, weight:row.weight_grams == null ? '' : String(row.weight_grams), version:row.version });
const columns = "id,type,to_char(entry_date,'YYYY-MM-DD') AS date,amount_cents,description,contact,weight_grams,version";

export async function createApp({ pool, user, password, origin, production = false }) {
  if (!user || user.length > 100 || !password || password.length < 12 || password.length > 256) throw new Error('Configure ADMIN_USER e ADMIN_PASSWORD (12 a 256 caracteres).');
  const allowedOrigin = new URL(origin).origin;
  if (production && !allowedOrigin.startsWith('https://')) throw new Error('Use HTTPS em produção.');
  const passwordHash = await scrypt(password, user, 64);
  const authVersion = hash(passwordHash);
  const cookieName = production ? '__Host-hm_session' : 'hm_session';
  const cookieOptions = { httpOnly:true, secure:production, sameSite:'strict', path:'/' };
  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use((req,res,next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" + (production ? '; upgrade-insecure-requests' : ''),
      'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
      'Referrer-Policy':'no-referrer', 'Cross-Origin-Opener-Policy':'same-origin',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
    });
    if (production) res.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({limit:'20kb'}));
  app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  app.get('/api/health', async (req,res,next) => { try { await pool.query('SELECT 1'); res.json({ok:true}); } catch { res.status(503).json({error:'Banco de dados indisponível.'}); } });
  app.use('/api', (req,res,next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') !== allowedOrigin) return res.status(403).json({error:'Origem inválida. Reabra o sistema pela URL configurada.'});
    next();
  });
  const readToken = req => {
    const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
    const value = cookie?.slice(cookieName.length + 1) || '';
    return /^[a-f0-9]{64}$/.test(value) ? value : '';
  };
  app.post('/api/login', async (req,res) => {
    const ipKey = hash('login:' + req.ip);
    const limit = await pool.query("INSERT INTO hm_login_limits(key,attempts,expires_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN hm_login_limits.expires_at < NOW() THEN 1 ELSE hm_login_limits.attempts+1 END, expires_at=CASE WHEN hm_login_limits.expires_at < NOW() THEN NOW()+INTERVAL '15 minutes' ELSE hm_login_limits.expires_at END RETURNING attempts", [ipKey]);
    if (limit.rows[0].attempts > 10) { res.set('Retry-After','900'); return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'}); }
    const inputPassword = typeof req.body?.password === 'string' && req.body.password.length <= 256 ? req.body.password : '';
    const provided = await scrypt(inputPassword, user, 64);
    if (!timingSafeEqual(provided,passwordHash) || req.body?.user !== user) return res.status(401).json({error:'Usuário ou senha incorretos.'});
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await pool.query("DELETE FROM hm_sessions WHERE expires_at < NOW() OR auth_version <> $1",[authVersion]);
    await pool.query("DELETE FROM hm_login_limits WHERE expires_at < NOW() OR key=$1",[ipKey]);
    const old = readToken(req);
    if (old) await pool.query('DELETE FROM hm_sessions WHERE token_hash=$1',[hash(old)]);
    await pool.query("INSERT INTO hm_sessions(token_hash,csrf_token,auth_version,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '12 hours')",[hash(token),csrf,authVersion]);
    res.cookie(cookieName,token,{...cookieOptions,maxAge:12*60*60*1000});
    res.json({user,csrf});
  });
  app.use('/api', async (req,res,next) => {
    const token = readToken(req);
    if (!token) return res.status(401).json({error:'Entre para acessar o sistema.'});
    const result = await pool.query('SELECT csrf_token FROM hm_sessions WHERE token_hash=$1 AND auth_version=$2 AND expires_at>NOW()',[hash(token),authVersion]);
    if (!result.rowCount) return res.status(401).json({error:'Sua sessão expirou. Entre novamente.'});
    req.tokenHash = hash(token); req.csrf = result.rows[0].csrf_token;
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('x-csrf-token') !== req.csrf) return res.status(403).json({error:'Sessão desatualizada. Recarregue a página.'});
    next();
  });
  app.get('/api/session', (req,res) => res.json({user,csrf:req.csrf}));
  app.post('/api/logout', async (req,res) => {
    await pool.query('DELETE FROM hm_sessions WHERE token_hash=$1',[req.tokenHash]);
    res.clearCookie(cookieName,cookieOptions); res.json({ok:true});
  });
  app.get('/api/entries', async (req,res) => {
    const {where,values,page} = filters(req.query);
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const totals = await client.query(`SELECT COUNT(*) AS count, COALESCE(SUM(amount_cents) FILTER(WHERE type='entrada'),0) AS incoming, COALESCE(SUM(amount_cents) FILTER(WHERE type='saida'),0) AS outgoing FROM hm_entries WHERE ${where}`,values);
      const result = await client.query(`SELECT ${columns} FROM hm_entries WHERE ${where} ORDER BY entry_date DESC,created_at DESC,id LIMIT 20 OFFSET $${values.length+1}`,[...values,(page-1)*20]);
      await client.query('COMMIT');
      const total = totals.rows[0];
      res.json({items:result.rows.map(serial),page,total:Number(total.count),summary:{incoming:String(total.incoming),outgoing:String(total.outgoing),balance:String(BigInt(total.incoming)-BigInt(total.outgoing))}});
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  async function mutate(req,res,action) {
    const id = uuid(action === 'create' ? req.body?.id : req.params.id);
    const data = action === 'delete' ? null : entry(req.body);
    if (action !== 'create') version(req.body?.version);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let result;
      if (action === 'create') {
        result = await client.query(`INSERT INTO hm_entries(id,type,entry_date,amount_cents,description,contact,weight_grams) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING ${columns}`,[id,data.type,data.date,data.amount,data.description,data.contact,data.weight]);
        if (!result.rowCount) {
          const existing = await client.query(`SELECT ${columns},deleted_at FROM hm_entries WHERE id=$1`,[id]);
          const row = existing.rows[0];
          if (!row || row.deleted_at || row.type!==data.type || row.date!==data.date || String(row.amount_cents)!==String(data.amount) || row.description!==data.description || row.contact!==data.contact || Number(row.weight_grams)!==Number(data.weight)) throw new HttpError(409,'Esse envio já foi usado. Atualize a lista antes de continuar.');
          await client.query('COMMIT'); return res.json(serial(row));
        }
      } else if (action === 'update') {
        result = await client.query(`UPDATE hm_entries SET type=$1,entry_date=$2,amount_cents=$3,description=$4,contact=$5,weight_grams=$6,version=version+1,updated_at=NOW() WHERE id=$7 AND version=$8 AND deleted_at IS NULL RETURNING ${columns}`,[data.type,data.date,data.amount,data.description,data.contact,data.weight,id,req.body.version]);
      } else {
        result = await client.query(`UPDATE hm_entries SET deleted_at=NOW(),updated_at=NOW(),version=version+1 WHERE id=$1 AND version=$2 AND deleted_at IS NULL RETURNING ${columns}`,[id,req.body.version]);
      }
      if (!result.rowCount) throw new HttpError(409,'O lançamento foi alterado ou excluído em outra aba. Atualize a lista.');
      const row = serial(result.rows[0]);
      await client.query('INSERT INTO hm_audit(entry_id,action,actor,snapshot) VALUES($1,$2,$3,$4::jsonb)',[id,action,user,JSON.stringify(row)]);
      await client.query('COMMIT'); res.status(action === 'create' ? 201 : 200).json(row);
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  app.post('/api/entries', (req,res) => mutate(req,res,'create'));
  app.put('/api/entries/:id', (req,res) => mutate(req,res,'update'));
  app.delete('/api/entries/:id', (req,res) => mutate(req,res,'delete'));
  registerFeatures(app,pool);
  app.use('/api', (req,res) => res.status(404).json({error:'Recurso não encontrado.'}));
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{etag:true,maxAge:0}));
  app.use((error,req,res,next) => {
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error('Falha na operação:', error.code || error.name);
    res.status(status).json({error:status===500 ? 'Não foi possível concluir a operação. Tente novamente.' : status===413 ? 'Conteúdo muito grande.' : error instanceof HttpError ? error.message : 'Requisição inválida.'});
  });
  return app;
}
