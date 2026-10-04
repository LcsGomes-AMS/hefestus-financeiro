'use strict';
const statusNames={orcamento:'Orçamento',aprovado:'Aprovado',imprimindo:'Imprimindo',entregue:'Entregue'};
const orderState={items:[],page:1,total:0,editing:null,id:'',busy:false,request:0,query:{}};
let chartRequest=0;
const tag=(name,text,className='')=>{const node=document.createElement(name);node.textContent=text;node.className=className;return node;};
const nav=document.querySelector('.sidebar nav');const orderLink=tag('a','▤  Pedidos');orderLink.href='#orders';nav.append(orderLink);
$('chart-year').value=today().slice(0,4);
async function loadChart(){
  const request=++chartRequest;$('chart-error').textContent='';
  try{
    const data=await api('/monthly?year='+encodeURIComponent($('chart-year').value));if(request!==chartRequest||!state.csrf)return;
    $('monthly-chart').replaceChildren();const max=Math.max(1,...data.months.flatMap(m=>[Math.abs(Number(m.incoming)),Math.abs(Number(m.outgoing)),Math.abs(Number(m.balance))]));
    for(const m of data.months){
      const label=new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(data.year,m.month-1,1)));
      const button=tag('button','');button.type='button';button.className='month-button';
      const full=`${label} ${data.year}: entradas ${money(m.incoming)}, saídas ${money(m.outgoing)}, resultado ${money(m.balance)}. Filtrar mês.`;
      button.title=full;button.setAttribute('aria-label',full);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 70 150');svg.setAttribute('aria-hidden','true');
      const baseline=document.createElementNS(svg.namespaceURI,'line');for(const[k,v]of Object.entries({x1:0,x2:70,y1:78,y2:78,stroke:'#717783'}))baseline.setAttribute(k,v);svg.append(baseline);
      [m.incoming,m.outgoing,m.balance].forEach((value,i)=>{const n=Number(value),height=Math.abs(n)/max*62;const rect=document.createElementNS(svg.namespaceURI,'rect');for(const[k,v]of Object.entries({x:8+i*19,y:n<0?78:78-height,width:12,height:Math.max(n===0?0:1,height),fill:['#83d5b3','#efa5a2','#f57c00'][i],rx:2}))rect.setAttribute(k,v);svg.append(rect);});
      button.append(svg,tag('strong',label),tag('small',money(m.balance)));
      button.addEventListener('click',()=>{
        const month=String(m.month).padStart(2,'0'),last=new Date(Date.UTC(data.year,m.month,0)).getUTCDate();
        $('from').value=`${data.year}-${month}-01`;$('to').value=`${data.year}-${month}-${last}`;$('filter-type').value='';$('search').value='';state.filters=collectFilters();state.page=1;loadEntries();$('transactions').scrollIntoView({behavior:'smooth'});toast(`Financeiro filtrado: ${label} de ${data.year}.`);
      });$('monthly-chart').append(button);
    }
  }catch(error){if(request===chartRequest){$('chart-error').textContent=error.message;$('monthly-chart').replaceChildren();}}
}
$('chart-form').addEventListener('submit',event=>{event.preventDefault();loadChart();});
async function downloadReport(format){
  $('report-error').textContent='';for(const id of ['export-xlsx','export-pdf'])$(id).disabled=true;
  try{
    const response=await fetch('/api/reports/'+format+'?'+new URLSearchParams(state.filters),{credentials:'same-origin'});
    if(!response.ok){const error=await response.json();if(response.status===401)showLogin();throw new Error(error.error||'Falha na exportação.');}
    const blob=await response.blob(),url=URL.createObjectURL(blob),link=tag('a','');link.href=url;link.download='hefestus-lancamentos.'+format;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Relatório gerado com os filtros aplicados.');
  }catch(error){$('report-error').textContent=error.message||'Não foi possível baixar o relatório.';}
  finally{for(const id of ['export-xlsx','export-pdf'])$(id).disabled=false;}
}
for(const format of ['xlsx','pdf'])$('export-'+format).addEventListener('click',()=>downloadReport(format));
async function loadOrders(){
  const request=++orderState.request;$('orders-error').textContent='';$('orders-count').textContent='Carregando pedidos…';$('orders-prev').disabled=true;$('orders-next').disabled=true;
  try{
    const data=await api('/orders?'+new URLSearchParams({...orderState.query,page:orderState.page}));if(request!==orderState.request||!state.csrf)return;
    if(orderState.page>1&&!data.items.length){orderState.page=Math.max(1,Math.ceil(data.total/40));return loadOrders();}
    orderState.items=data.items;orderState.total=data.total;renderOrders();
    $('orders-count').textContent=`${data.total} pedido(s) encontrado(s). ${data.items.length} nesta página, agrupados por etapa.`;
    $('orders-page').textContent=`Página ${orderState.page} de ${Math.max(1,Math.ceil(data.total/40))}`;$('orders-prev').disabled=orderState.page<=1;$('orders-next').disabled=orderState.page*40>=data.total;
  }catch(error){if(request===orderState.request){$('orders-error').textContent=error.message;$('order-board').replaceChildren();$('orders-count').textContent='Não foi possível carregar os pedidos.';}}
}
function renderOrders(){
  $('order-board').replaceChildren();
  for(const[status,name]of Object.entries(statusNames)){
    const column=tag('section','','order-column'),orders=orderState.items.filter(item=>item.status===status);column.append(tag('h3',`${name} · ${orders.length}`));
    if(!orders.length)column.append(tag('p','Nenhum pedido nesta página.','order-empty'));
    for(const item of orders){
      const card=tag('article','','order-card');card.append(tag('h4',item.description),tag('p',item.contact||'Cliente não informado'));
      const amount=item.amount?money(BigInt(item.amount.replace('.',''))):'Valor a combinar';
      card.append(tag('strong',amount),tag('small',`Peso: ${item.weight?item.weight.replace('.',',')+' g':'não informado'}`),tag('small',`Prazo: ${item.dueDate?formatDate(item.dueDate):'não informado'}`));
      const edit=tag('button','Editar','secondary');edit.type='button';edit.setAttribute('aria-label','Editar pedido: '+item.description);edit.addEventListener('click',()=>openOrder(item));card.append(edit);
      const next=Object.keys(statusNames)[Object.keys(statusNames).indexOf(status)+1];
      if(next){const advance=tag('button',statusNames[next],'text-button');advance.type='button';advance.setAttribute('aria-label',`Mover ${item.description} para ${statusNames[next]}`);advance.addEventListener('click',async()=>{advance.disabled=true;try{await api('/orders/'+item.id,{method:'PUT',body:JSON.stringify({...item,status:next})});await loadOrders();toast('Etapa atualizada.');}catch(error){$('orders-error').textContent=error.message;}finally{advance.disabled=false;}});card.append(advance);}column.append(card);
    }$('order-board').append(column);
  }
}
function openOrder(item=null){
  orderState.editing=item;orderState.id=item?.id||crypto.randomUUID();$('order-form').reset();$('order-title').textContent=item?'Editar pedido':'Novo pedido';$('order-error').textContent='';
  for(const[id,key]of [['description','description'],['contact','contact'],['status','status'],['amount','amount'],['weight','weight'],['due','dueDate']])$('order-'+id).value=item?.[key]||(key==='status'?'orcamento':'');
  $('order-dialog').showModal();$('order-description').focus();
}
$('new-order').addEventListener('click',()=>openOrder());for(const id of ['close-order','cancel-order'])$(id).addEventListener('click',()=>{if(!orderState.busy)$('order-dialog').close();});$('order-dialog').addEventListener('cancel',event=>{if(orderState.busy)event.preventDefault();});
$('order-form').addEventListener('submit',async event=>{
  event.preventDefault();if(orderState.busy)return;orderState.busy=true;$('save-order').disabled=true;$('order-error').textContent='';
  const body={id:orderState.id,description:$('order-description').value.trim(),contact:$('order-contact').value.trim(),status:$('order-status').value,amount:$('order-amount').value.trim(),weight:$('order-weight').value.trim(),dueDate:$('order-due').value,...(orderState.editing?{version:orderState.editing.version}:{})};
  try{await api(orderState.editing?'/orders/'+body.id:'/orders',{method:orderState.editing?'PUT':'POST',body:JSON.stringify(body)});$('order-dialog').close();await loadOrders();toast('Pedido salvo. Os filtros de pedidos continuam aplicados.');}catch(error){$('order-error').textContent=error.message;}finally{orderState.busy=false;$('save-order').disabled=false;}
});
$('orders-filter').addEventListener('submit',event=>{event.preventDefault();orderState.query={search:$('order-search').value.trim(),status:$('order-filter-status').value};orderState.page=1;loadOrders();});
$('orders-prev').addEventListener('click',()=>{orderState.page--;loadOrders();});$('orders-next').addEventListener('click',()=>{orderState.page++;loadOrders();});
document.addEventListener('hm-login',()=>{loadOrders();loadChart();});document.addEventListener('hm-entries',loadChart);
document.addEventListener('hm-logout',()=>{chartRequest++;orderState.request++;$('order-dialog').close();$('order-board').replaceChildren();$('monthly-chart').replaceChildren();orderState.items=[];});
if(state.csrf){loadOrders();loadChart();}
