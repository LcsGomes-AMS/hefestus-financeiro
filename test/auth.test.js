import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
// Test double apenas para autenticação. Não substitui os testes SQL de integração.
function authPool(){
  const sessions=new Map();let attempts=0;
  return {sessions, async query(sql,args=[]){
    if(sql.startsWith('INSERT INTO hm_login_limits'))return{rows:[{attempts:++attempts}],rowCount:1};
    if(sql.startsWith('DELETE FROM hm_login_limits')){attempts=0;return{rows:[],rowCount:1};}
    if(sql.startsWith('INSERT INTO hm_sessions')){sessions.set(args[0],{csrf_token:args[1],auth:args[2]});return{rows:[],rowCount:1};}
    if(sql.startsWith('SELECT csrf_token')){const session=sessions.get(args[0]);return{rows:session&&session.auth===args[1]?[session]:[],rowCount:session&&session.auth===args[1]?1:0};}
    if(sql.startsWith('DELETE FROM hm_sessions WHERE token_hash')){sessions.delete(args[0]);return{rows:[],rowCount:1};}
    if(sql.startsWith('DELETE FROM hm_sessions WHERE expires_at'))return{rows:[],rowCount:0};
    if(sql==='SELECT 1')return{rows:[{}],rowCount:1};
    throw new Error('Consulta inesperada no teste de autenticação');
  }};
}
test('login, cookie, autorização, CSRF, logout e limite de tentativas',async t=>{
  const pool=authPool();const origin='http://localhost:3000';
  const app=await createApp({pool,user:'admin',password:'uma-senha-de-teste',origin});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body={},headers={})=>fetch(url+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await fetch(url+'/api/entries')).status,401);
  assert.equal((await post('/api/login',{user:'admin',password:'uma-senha-de-teste'},{origin:'https://outro.example'})).status,403);
  assert.equal((await post('/api/login',{user:'admin',password:'incorreta'})).status,401);
  const login=await post('/api/login',{user:'admin',password:'uma-senha-de-teste'});
  assert.equal(login.status,200);const {csrf}=await login.json();const rawCookie=login.headers.get('set-cookie');
  assert.match(rawCookie,/HttpOnly/);assert.match(rawCookie,/SameSite=Strict/);const cookie=rawCookie.split(';')[0];
  const session=await fetch(url+'/api/session',{headers:{cookie}});assert.equal(session.status,200);
  assert.equal((await post('/api/entries',{}, {cookie})).status,403);
  assert.equal((await post('/api/entries',{}, {cookie,'x-csrf-token':csrf})).status,400);
  assert.equal((await post('/api/logout',{}, {cookie,'x-csrf-token':csrf})).status,200);
  assert.equal((await fetch(url+'/api/session',{headers:{cookie}})).status,401);
  for(let i=0;i<10;i++)assert.equal((await post('/api/login',{user:'admin',password:'incorreta'})).status,401);
  assert.equal((await post('/api/login',{user:'admin',password:'incorreta'})).status,429);
  const html=await fetch(url+'/');assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(html.status,200);
});
