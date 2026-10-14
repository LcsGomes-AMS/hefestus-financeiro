'use strict';
const deleteOrderState={item:null,busy:false};
function openDeleteOrder(item){
  deleteOrderState.item=item;$('delete-order-name').textContent=item.description;
  $('delete-order-error').textContent='';$('delete-order-dialog').showModal();$('cancel-delete-order').focus();
}
function closeDeleteOrder(){if(!deleteOrderState.busy){$('delete-order-dialog').close();deleteOrderState.item=null;}}
$('cancel-delete-order').addEventListener('click',closeDeleteOrder);
$('delete-order-dialog').addEventListener('cancel',event=>{if(deleteOrderState.busy)event.preventDefault();else deleteOrderState.item=null;});
$('confirm-delete-order').addEventListener('click',async()=>{
  if(deleteOrderState.busy||!deleteOrderState.item)return;
  const item=deleteOrderState.item;deleteOrderState.busy=true;
  $('confirm-delete-order').disabled=true;$('confirm-delete-order').textContent='Excluindo…';$('delete-order-error').textContent='';
  try{
    await api('/orders/'+item.id,{method:'DELETE',body:JSON.stringify({version:item.version})});
    if(!state.csrf)return;
    $('delete-order-dialog').close();deleteOrderState.item=null;
    document.dispatchEvent(new CustomEvent('hm-order-deleted',{detail:{id:item.id}}));
    await loadOrders();toast('Pedido excluído. O link de acompanhamento foi desativado.');
  }catch(error){$('delete-order-error').textContent=error.message;}
  finally{deleteOrderState.busy=false;$('confirm-delete-order').disabled=false;$('confirm-delete-order').textContent='Excluir pedido';}
});
document.addEventListener('hm-logout',()=>{$('delete-order-dialog').close();deleteOrderState.item=null;$('delete-order-name').textContent='';$('delete-order-error').textContent='';});
