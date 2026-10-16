'use strict';
const proofsState={order:null,request:0,busy:false,removing:null};
function closeProofs(){if(proofsState.busy)return;proofsState.request++;$('proofs-dialog').close();$('proofs-form').reset();$('proofs-list').replaceChildren();}
async function openProofs(item){proofsState.order=item;$('proofs-order').textContent=item.description;$('proofs-form').reset();$('proofs-error').textContent='';$('proofs-dialog').showModal();await loadProofs();}
async function loadProofs(){
  const request=++proofsState.request,order=proofsState.order;$('proofs-list').replaceChildren();$('proofs-count').textContent='Carregando comprovantes…';
  try{const data=await api('/orders/'+order.id+'/proofs');if(request!==proofsState.request||!state.csrf)return;
    $('proofs-count').textContent=data.items.length?`${data.items.length} de ${data.maxFiles} comprovantes anexados.`:'Nenhum comprovante anexado neste pedido.';
    for(const file of data.items){
      const article=tag('article','','proof-item'),url='/api/orders/'+order.id+'/proofs/'+file.id+'/file';
      article.append(tag('strong',file.name),tag('p',(file.type==='application/pdf'?'PDF':'Imagem')+' · '+(file.size/1024).toLocaleString('pt-BR',{maximumFractionDigits:0})+' KB · '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(file.createdAt))));
      const actions=tag('div','','proof-actions');
      if(file.type.startsWith('image/')){
        const image=document.createElement('img');image.alt='Comprovante: '+file.name;image.hidden=true;image.className='proof-preview';
        const preview=tag('button','Visualizar','secondary');preview.type='button';preview.setAttribute('aria-expanded','false');preview.addEventListener('click',()=>{if(!image.src)image.src=url;image.hidden=!image.hidden;preview.textContent=image.hidden?'Visualizar':'Ocultar imagem';preview.setAttribute('aria-expanded',String(!image.hidden));});actions.append(preview);article.append(image);
      }else{const view=tag('a','Abrir PDF','secondary');view.href=url;view.target='_blank';view.rel='noopener noreferrer';actions.append(view);}
      const download=tag('a','Baixar','secondary');download.href=url+'?download=1';download.setAttribute('download',file.name);actions.append(download);
      const remove=tag('button','Remover','danger');remove.type='button';remove.setAttribute('aria-label','Remover comprovante: '+file.name);remove.addEventListener('click',()=>{proofsState.removing=file;$('remove-proof-name').textContent=file.name;$('remove-proof-error').textContent='';$('remove-proof-dialog').showModal();$('cancel-remove-proof').focus();});actions.append(remove);article.append(actions);$('proofs-list').append(article);
    }
  }catch(error){if(request===proofsState.request){$('proofs-error').textContent=error.message;$('proofs-count').textContent='Não foi possível carregar os comprovantes.';}}
}
$('close-proofs').addEventListener('click',closeProofs);$('proofs-dialog').addEventListener('cancel',event=>{if(proofsState.busy)event.preventDefault();else proofsState.request++;});
$('proofs-form').addEventListener('submit',async event=>{
  event.preventDefault();if(proofsState.busy)return;const file=$('proof-file').files[0];if(!file)return;
  $('proofs-error').textContent='';if(file.size>5*1024*1024){$('proofs-error').textContent='O arquivo deve ter no máximo 5 MB.';return;}
  proofsState.busy=true;$('save-proof').disabled=true;$('save-proof').textContent='Salvando…';$('proof-file').disabled=true;
  try{
    const response=await fetch('/api/orders/'+proofsState.order.id+'/proofs',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type||'application/octet-stream','X-CSRF-Token':state.csrf,'X-File-Name':encodeURIComponent(file.name)},body:file});
    const data=await response.json();if(!response.ok){if(response.status===401)showLogin();throw Error(data.error||'Não foi possível salvar o comprovante.');}
    if(!state.csrf)return;$('proofs-form').reset();await loadProofs();toast(data.duplicate?'Este arquivo já está anexado ao pedido.':'Comprovante salvo no pedido.');
  }catch(error){$('proofs-error').textContent=error instanceof TypeError?'Sem conexão. Tente enviar novamente.':error.message;}
  finally{proofsState.busy=false;$('save-proof').disabled=false;$('save-proof').textContent='Salvar comprovante';$('proof-file').disabled=false;}
});
$('cancel-remove-proof').addEventListener('click',()=>{if(!proofsState.busy)$('remove-proof-dialog').close();});$('remove-proof-dialog').addEventListener('cancel',event=>{if(proofsState.busy)event.preventDefault();});
$('confirm-remove-proof').addEventListener('click',async()=>{
  if(proofsState.busy||!proofsState.removing)return;proofsState.busy=true;$('confirm-remove-proof').disabled=true;$('remove-proof-error').textContent='';
  try{await api('/orders/'+proofsState.order.id+'/proofs/'+proofsState.removing.id,{method:'DELETE',body:'{}'});if(!state.csrf)return;$('remove-proof-dialog').close();await loadProofs();toast('Comprovante removido.');}
  catch(error){$('remove-proof-error').textContent=error.message;}finally{proofsState.busy=false;$('confirm-remove-proof').disabled=false;}
});
document.addEventListener('hm-logout',()=>{proofsState.request++;$('proofs-dialog').close();$('remove-proof-dialog').close();$('proofs-form').reset();$('proofs-list').replaceChildren();proofsState.order=null;proofsState.removing=null;});
document.addEventListener('hm-order-deleted',event=>{if(proofsState.order?.id===event.detail.id){proofsState.request++;$('proofs-dialog').close();$('remove-proof-dialog').close();$('proofs-list').replaceChildren();}});
