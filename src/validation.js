export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function cents(value) {
  if (typeof value !== 'string' || !/^\d{1,9}([.,]\d{1,2})?$/.test(value.trim())) {
    throw new HttpError(400, 'Informe um valor positivo, sem separador de milhar e com até duas casas decimais.');
  }
  const [whole, decimal = ''] = value.trim().replace(',', '.').split('.');
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (amount < 1 || amount > 99999999999) throw new HttpError(400, 'Valor fora do limite permitido.');
  return amount;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)) throw new HttpError(400, 'Identificador inválido.');
  return value;
}
export function version(value) {
  if (!Number.isInteger(value) || value < 1) throw new HttpError(400, 'Versão inválida. Atualize a lista.');
  return value;
}
export function category(value) {
  if(value === undefined || value === null || value === '') return 'Sem categoria';
  if(typeof value !== 'string' || value.trim().length > 80) throw new HttpError(400,'A categoria deve ter até 80 caracteres.');
  return value.trim() || 'Sem categoria';
}
export function entry(body) {
  if (!body || !['entrada','saida'].includes(body.type)) throw new HttpError(400, 'Selecione entrada ou saída.');
  if (!validDate(body.date)) throw new HttpError(400, 'Informe uma data válida entre 2000 e 2100.');
  if (typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 2000) throw new HttpError(400, 'Informe a descrição com até 2.000 caracteres.');
  if (typeof body.contact !== 'string' || body.contact.trim().length > 160) throw new HttpError(400, 'Cliente ou fornecedor deve ter até 160 caracteres.');
  let weight = null;
  if (body.weight !== '' && body.weight != null) {
    if (typeof body.weight !== 'string' || !/^\d{1,8}([.,]\d{1,2})?$/.test(body.weight) || Number(body.weight.replace(',', '.')) <= 0) throw new HttpError(400, 'Informe um peso positivo com até duas casas decimais.');
    weight = body.weight.replace(',', '.');
  }
  return { type: body.type, date: body.date, amount: cents(body.amount), description: body.description.trim(), contact: body.contact.trim(), weight };
}
export function filters(query) {
  const from = query.from || '', to = query.to || '', type = query.type || '', search = query.search || '';
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) throw new HttpError(400, 'Confira o início e o fim do período.');
  if (type && !['entrada','saida'].includes(type)) throw new HttpError(400, 'Tipo de lançamento inválido.');
  if (typeof search !== 'string' || search.length > 160) throw new HttpError(400, 'Busca muito longa.');
  const page = Number(query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new HttpError(400, 'Página inválida.');
  const values = [], where = ['deleted_at IS NULL'];
  const add = (sql, value) => { values.push(value); where.push(sql.replaceAll('?', '$' + values.length)); };
  if (from) add('entry_date >= ?::date', from);
  if (to) add('entry_date <= ?::date', to);
  if (type) add('type = ?', type);
  if (search.trim()) add("(description ILIKE ? OR contact ILIKE ?)", '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%');
  return { where: where.join(' AND '), values, page };
}
