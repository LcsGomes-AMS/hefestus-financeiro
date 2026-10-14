'use strict';
const get=id=>document.getElementById(id),stages=['orcamento','aprovado','imprimindo','entregue'];
const labels={orcamento:'Em orçamento',aprovado:'Aprovado',imprimindo:'Em impressão',entregue:'Entregue'};
let loading=false,timer;
const dateTime=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
async function load(){
  if(loading)return;loading=true;clearTimeout(timer);get('refresh-tracking').disabled=true;get('tracking-error').hidden=true;
  let repeat=true;const requestedHash=location.hash;
  try{
    const token=location.hash.slice(1);
    if(!/^[a-f0-9]{64}$/.test(token)){repeat=false;throw Error('Link incompleto ou indisponível. Solicite o link completo à Hefestus Maker.');}
    const response=await fetch('/api/public/tracking',{headers:{'X-Tracking-Token':token},credentials:'omit',cache:'no-store'});
    const data=await response.json();
    if(location.hash!==requestedHash)return;
    if(!response.ok){if(response.status===404)repeat=false;throw Error(data.error||'Não foi possível consultar seu pedido.');}
    const index=stages.indexOf(data.status);if(index<0)throw Error('Etapa indisponível. Tente novamente mais tarde.');
    get('reference').textContent='Pedido '+data.reference;get('status-label').textContent=labels[data.status];
    document.querySelectorAll('[data-stage]').forEach((item,i)=>{item.classList.toggle('completed',i<index);item.classList.toggle('current',i===index);if(i===index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
    get('due-label').textContent=data.status==='entregue'?'Previsão registrada':'Previsão de entrega';
    get('due-date').textContent=data.dueDate?data.dueDate.split('-').reverse().join('/'):data.status==='entregue'?'Não informada':'A combinar';
    get('due-note').textContent=data.status==='entregue'?'O pedido foi marcado como entregue pela equipe.':data.dueDate?'Previsão informada pela equipe, sujeita a ajustes.':'A equipe ainda vai confirmar a previsão de entrega.';
    get('last-update').textContent='Pedido atualizado em '+dateTime(data.updatedAt)+' (São Paulo).';
    get('checked-at').textContent='Consulta realizada em '+dateTime(Date.now())+'.';
    get('tracking-content').hidden=false;
  }catch(error){get('tracking-content').hidden=true;get('tracking-error').textContent=error instanceof TypeError?'Sem conexão com o sistema. Verifique sua internet e tente novamente.':error.message;get('tracking-error').hidden=false;}
  finally{get('loading').hidden=true;get('refresh-tracking').disabled=false;loading=false;if(location.hash!==requestedHash)load();else if(repeat)timer=setTimeout(()=>{if(!document.hidden)load();},60000);}
}
get('refresh-tracking').addEventListener('click',load);window.addEventListener('hashchange',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});load();
