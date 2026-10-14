'use strict';
const trackingCache=new Map();
const linkState={order:null,meta:null,request:0,busy:false};
function trackingDate(value){return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value));}
function showTrackingState(){
  const meta=linkState.meta,stored=trackingCache.get(linkState.order.id),cached=stored?.version===meta.version&&meta.enabled?stored:null;
  if(!cached)trackingCache.delete(linkState.order.id);
  $('tracking-link').value=cached?.url||'';$('copy-tracking').disabled=!cached;
  $('preview-tracking').hidden=!cached;if(cached)$('preview-tracking').href=cached.url;else $('preview-tracking').removeAttribute('href');
  $('issue-tracking').disabled=false;$('revoke-tracking').disabled=!meta.hasLink;
  $('issue-tracking').textContent=meta.hasLink?'Renovar link':'Gerar link privado';
  $('tracking-state').textContent=meta.enabled?'Link ativo até '+trackingDate(meta.expiresAt)+' (São Paulo).':meta.hasLink?'O link anterior expirou. Gere um novo link para o cliente.':'Nenhum link ativo para este pedido.';
  $('tracking-rotation-note').textContent=meta.hasLink?'Renovar invalida o link anterior. O link completo só fica disponível nesta sessão após a geração.':'';
}
async function openTracking(order){
  linkState.order=order;linkState.meta=null;const request=++linkState.request;
  $('tracking-link').value='';$('tracking-error-admin').textContent='';$('tracking-state').textContent='Consultando o link do pedido…';$('tracking-order-title').textContent=order.description;
  $('issue-tracking').disabled=true;$('revoke-tracking').disabled=true;$('copy-tracking').disabled=true;$('preview-tracking').hidden=true;$('tracking-rotation-note').textContent='';
  $('tracking-dialog').showModal();
  try{const data=await api('/orders/'+order.id+'/tracking');if(request!==linkState.request||!state.csrf)return;linkState.meta=data;showTrackingState();}
  catch(error){if(request===linkState.request)$('tracking-error-admin').textContent=error.message;}
}
function closeTracking(){if(linkState.busy)return;linkState.request++;$('tracking-dialog').close();$('tracking-link').value='';}
$('close-tracking').addEventListener('click',closeTracking);$('tracking-dialog').addEventListener('cancel',event=>{if(linkState.busy)event.preventDefault();else{linkState.request++;$('tracking-link').value='';}});
async function changeTracking(revoke){
  if(linkState.busy||!linkState.meta)return;linkState.busy=true;$('tracking-error-admin').textContent='';$('issue-tracking').disabled=true;$('revoke-tracking').disabled=true;$('copy-tracking').disabled=true;$('preview-tracking').hidden=true;
  try{
    const data=await api('/orders/'+linkState.order.id+'/tracking',{method:revoke?'DELETE':'POST',body:JSON.stringify({version:linkState.meta.version})});
    if(!state.csrf)return;linkState.meta=data;
    if(data.url)trackingCache.set(linkState.order.id,{url:data.url,version:data.version});else trackingCache.delete(linkState.order.id);
    showTrackingState();toast(revoke?'Link desativado.':'Link gerado. Copie e compartilhe com o cliente.');
  }catch(error){if(state.csrf){$('tracking-error-admin').textContent=error.message;showTrackingState();}}
  finally{linkState.busy=false;}
}
$('issue-tracking').addEventListener('click',()=>changeTracking(false));$('revoke-tracking').addEventListener('click',()=>changeTracking(true));
$('copy-tracking').addEventListener('click',async()=>{
  const value=$('tracking-link').value;if(!value)return;
  try{await navigator.clipboard.writeText(value);toast('Link copiado.');}
  catch{$('tracking-link').focus();$('tracking-link').select();$('tracking-error-admin').textContent='Selecione e copie o link no campo acima.';}
});
document.addEventListener('hm-logout',()=>{trackingCache.clear();linkState.request++;linkState.meta=null;$('tracking-dialog').close();$('tracking-link').value='';$('preview-tracking').removeAttribute('href');});

document.addEventListener('hm-order-deleted',event=>{trackingCache.delete(event.detail.id);if(linkState.order?.id===event.detail.id){linkState.request++;linkState.meta=null;$('tracking-dialog').close();$('tracking-link').value='';$('preview-tracking').removeAttribute('href');}});
