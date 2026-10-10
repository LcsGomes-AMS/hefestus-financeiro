'use strict';
const $ = id => document.getElementById(id);
const state = { csrf:'', page:1, items:[], total:0, filters:{}, editing:null, deleting:null, draftId:'', loading:false, saving:false, loadId:0 };
const money = value => {
  const n = BigInt(value), abs = n < 0n ? -n : n;
  return `${n < 0n ? '− ' : ''}R$ ${(abs/100n).toLocaleString('pt-BR')},${String(abs%100n).padStart(2,'0')}`;
};
const decimal = value => { const n=BigInt(value); return `${n/100n},${String(n%100n).padStart(2,'0')}`; };
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const formatDate = value => value.split('-').reverse().join('/');
let toastTimer;
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,6500); }
function showLogin() {
  state.csrf=''; state.loadId++; state.items=[];
  $('entry-dialog').close(); $('delete-dialog').close();
  document.dispatchEvent(new Event('hm-logout'));
  $('dashboard').hidden=true; $('login-screen').hidden=false; $('boot').hidden=true;
  $('entry-rows').replaceChildren();
}
async function api(path, options={}) {
  let response;
  try { response=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(state.csrf?{'X-CSRF-Token':state.csrf}:{}),...options.headers}}); }
  catch { throw new Error('Sem conexão com o servidor. Confira sua internet e tente novamente.'); }
  const data=await response.json().catch(()=>({error:'Resposta inesperada do servidor.'}));
  if(!response.ok) {
    if(response.status===401 && path!=='/login') { const expired=Boolean(state.csrf); showLogin(); $('login-error').textContent=expired?'Sua sessão expirou. Entre novamente.':''; }
    throw new Error(data.error || 'Não foi possível concluir a operação.');
  }
  return data;
}
function loggedIn(session) {state.csrf=session.csrf; $('account-name').textContent=session.user; $('login-screen').hidden=true; $('dashboard').hidden=false; $('boot').hidden=true; $('login-password').value=''; document.dispatchEvent(new Event('hm-login'));}
function collectFilters() { return {from:$('from').value,to:$('to').value,type:$('filter-type').value,search:$('search').value.trim()}; }
function summaryUnavailable() { for(const id of ['incoming','outgoing','balance']) $(id).textContent='—'; }
async function loadEntries() {
  const loadId=++state.loadId; state.loading=true; $('page-error').textContent=''; $('result-count').textContent='Carregando registros…';
  $('previous').disabled=true; $('next').disabled=true; $('refresh').disabled=true;
  try {
    const query=new URLSearchParams({...state.filters,page:String(state.page)});
    const data=await api('/entries?'+query);
    if(loadId!==state.loadId)return;
    if(state.page>1 && !data.items.length){ state.page=Math.max(1,Math.ceil(data.total/20)); return await loadEntries(); }
    state.items=data.items; state.total=data.total;
    for(const id of ['incoming','outgoing','balance']) $(id).textContent=money(data.summary[id]);
    renderRows();
    document.dispatchEvent(new Event('hm-entries'));
    $('result-count').textContent=`${data.total} ${data.total===1?'lançamento encontrado':'lançamentos encontrados'}`;
    $('page-label').textContent=`Página ${state.page} de ${Math.max(1,Math.ceil(data.total/20))}`;
    $('previous').disabled=state.page<=1; $('next').disabled=state.page*20>=data.total;
  } catch(error) {
    if(loadId!==state.loadId)return;
    $('page-error').textContent=error.message; $('result-count').textContent='Não foi possível carregar os registros.';
    state.items=[]; $('entry-rows').replaceChildren(); $('empty').hidden=true; summaryUnavailable();
  } finally { if(loadId===state.loadId){state.loading=false;$('refresh').disabled=false;} }
}
function cell(text,className='') {const td=document.createElement('td');td.textContent=text;td.className=className;return td;}
function renderRows() {
  $('entry-rows').replaceChildren(); $('empty').hidden=state.items.length>0; $('table-wrap').hidden=state.items.length===0;
  for(const item of state.items) {
    const row=document.createElement('tr'); row.append(cell(formatDate(item.date),'date-cell'));
    const description=cell('','description-cell'); const title=document.createElement('strong');title.textContent=item.description;description.append(title);
    if(item.contact){const contact=document.createElement('small');contact.textContent=item.contact;description.append(contact);}if(item.category && item.category!=='Sem categoria'){const categoryLabel=document.createElement('small');categoryLabel.textContent='Categoria: '+item.category;description.append(categoryLabel);}row.append(description);
    const type=cell('');const badge=document.createElement('span');badge.className='badge '+item.type;badge.textContent=item.type==='entrada'?'Entrada':'Saída';type.append(badge);row.append(type);
    row.append(cell(item.weight?Number(item.weight).toLocaleString('pt-BR',{maximumFractionDigits:2})+' g':'—','weight-cell'));
    row.append(cell((item.type==='saida'?'− ':'+ ')+money(item.amountCents),'value-col '+(item.type==='entrada'?'amount-in':'amount-out')));
    const actions=cell('');const buttons=document.createElement('div');buttons.className='row-actions';
    for(const [label,action] of [['Editar',()=>openEntry(item)],['Excluir',()=>openDelete(item)]]) {const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' lançamento: '+item.description);button.addEventListener('click',action);buttons.append(button);}actions.append(buttons);row.append(actions);$('entry-rows').append(row);
  }
}
function openEntry(item=null) {
  $('entry-form').reset();state.editing=item;state.draftId=item?.id || crypto.randomUUID();
  $('entry-title').textContent=item?'Editar lançamento':'Novo lançamento';$('entry-error').textContent='';
  $('entry-date').value=item?.date || today();$('amount').value=item?decimal(item.amountCents):'';
  $('category').value=item?.category==='Sem categoria'?'':(item?.category||'');$('description').value=item?.description || '';$('contact').value=item?.contact || '';$('weight').value=item?.weight || '';
  $('entry-form').elements.type.value=item?.type || 'entrada';
  $('entry-dialog').showModal();$('amount').focus();
}
function closeEntry(){if(!state.saving)$('entry-dialog').close();}
function openDelete(item) {state.deleting=item;$('delete-description').textContent=`${item.description} · ${money(item.amountCents)}`;$('delete-error').textContent='';$('delete-dialog').showModal();$('cancel-delete').focus();}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;$('login-error').textContent='';
  try { const session=await api('/login',{method:'POST',body:JSON.stringify({user:$('login-user').value.trim(),password:$('login-password').value})});loggedIn(session);await loadEntries(); }
  catch(error){$('login-error').textContent=error.message;}finally{button.disabled=false;}
});
$('logout').addEventListener('click',async()=>{
  $('logout').disabled=true;
  try {await api('/logout',{method:'POST',body:'{}'});showLogin();$('entry-form').reset();$('login-error').textContent='';$('login-password').focus();}
  catch(error){toast(error.message);}finally{$('logout').disabled=false;}
});
$('filter-form').addEventListener('submit',event=>{event.preventDefault();state.filters=collectFilters();state.page=1;loadEntries();});
$('clear-filters').addEventListener('click',()=>{$('filter-form').reset();state.filters=collectFilters();state.page=1;loadEntries();});
$('refresh').addEventListener('click',()=>loadEntries());
$('previous').addEventListener('click',()=>{if(state.page>1){state.page--;loadEntries();}});
$('next').addEventListener('click',()=>{if(state.page*20<state.total){state.page++;loadEntries();}});
for(const id of ['new-entry','empty-add'])$(id).addEventListener('click',()=>openEntry());
for(const id of ['close-entry','cancel-entry'])$(id).addEventListener('click',closeEntry);
$('entry-dialog').addEventListener('cancel',event=>{if(state.saving)event.preventDefault();});
$('entry-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.saving)return;
  const payload={id:state.draftId,type:$('entry-form').elements.type.value,date:$('entry-date').value,amount:$('amount').value.trim(),description:$('description').value.trim(),category:$('category').value.trim(),weight:$('weight').value.trim(),contact:$('contact').value.trim(),...(state.editing?{version:state.editing.version}:{})};
  if(!payload.description){$('entry-error').textContent='Informe uma descrição.';return;}
  state.saving=true;$('save-entry').disabled=true;$('save-entry').textContent='Salvando…';$('entry-error').textContent='';
  try {
    await api(state.editing?'/entries/'+state.editing.id:'/entries',{method:state.editing?'PUT':'POST',body:JSON.stringify(payload)});
    $('entry-dialog').close();toast('Lançamento salvo. Os filtros atuais continuam aplicados.');await loadEntries();
  } catch(error){$('entry-error').textContent=error.message;}
  finally{state.saving=false;$('save-entry').disabled=false;$('save-entry').textContent='Salvar lançamento';}
});
$('cancel-delete').addEventListener('click',()=>{if(!state.saving)$('delete-dialog').close();});
$('delete-dialog').addEventListener('cancel',event=>{if(state.saving)event.preventDefault();});
$('confirm-delete').addEventListener('click',async()=>{
  if(state.saving || !state.deleting)return;state.saving=true;$('confirm-delete').disabled=true;$('delete-error').textContent='';
  try{await api('/entries/'+state.deleting.id,{method:'DELETE',body:JSON.stringify({version:state.deleting.version})});$('delete-dialog').close();toast('Lançamento excluído dos totais.');await loadEntries();}
  catch(error){$('delete-error').textContent=error.message;}finally{state.saving=false;$('confirm-delete').disabled=false;}
});
(async()=>{
  const date=today();$('from').value=date.slice(0,8)+'01';$('to').value=date;state.filters=collectFilters();
  try{loggedIn(await api('/session'));await loadEntries();}
  catch(error){showLogin();if(!error.message.includes('Entre para acessar'))$('login-error').textContent=error.message;}
})();
