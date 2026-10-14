import {HttpError,uuid,version} from './validation.js';

export async function deleteOrder(pool,id,expectedVersion){
  uuid(id);version(expectedVersion);
  // Uma única alteração atômica retira o pedido do quadro e invalida o link.
  const result=await pool.query(`UPDATE hm_orders SET deleted_at=NOW(),updated_at=NOW(),version=version+1,
    tracking_token_hash=NULL,tracking_expires_at=NULL,tracking_version=tracking_version+1
    WHERE id=$1 AND version=$2 AND deleted_at IS NULL RETURNING id`,[id,expectedVersion]);
  if(!result.rowCount)throw new HttpError(409,'O pedido foi alterado ou excluído em outra aba. Atualize o quadro antes de continuar.');
  return {ok:true};
}
