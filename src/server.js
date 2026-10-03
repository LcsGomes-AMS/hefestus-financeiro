import { createPool, migrate } from './db.js';
import { createApp } from './app.js';
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const origin = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (production ? '' : `http://localhost:${port}`);
let pool;
try {
  if (!origin) throw new Error('Configure APP_URL com a URL HTTPS do sistema.');
  pool = createPool(process.env.DATABASE_URL);
  pool.on('error',error=>console.error('Erro de conexão com banco:',error.code || error.name));
  const app = await createApp({pool,user:process.env.ADMIN_USER || 'admin',password:process.env.ADMIN_PASSWORD,origin,production});
  await migrate(pool);
  const server = app.listen(port,'0.0.0.0',()=>console.log(`Hefestus Financeiro disponível na porta ${port}`));
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{
    server.close(async()=>{await pool.end();process.exit(0);});
    setTimeout(()=>process.exit(1),10000).unref();
  });
} catch(error) {
  console.error('Inicialização não concluída:',error.code || (error.message.startsWith('Configure') || error.message.startsWith('Use HTTPS') ? error.message : 'Confira a configuração e a conexão com o banco.'));
  if(pool) await pool.end();
  process.exit(1);
}
