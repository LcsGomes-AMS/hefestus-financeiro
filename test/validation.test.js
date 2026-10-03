import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,validDate,entry,filters,uuid,version} from '../src/validation.js';
test('dinheiro é convertido em centavos sem arredondamento binário',()=>{
  assert.equal(cents('0,01'),1);assert.equal(cents('20.10'),2010);assert.equal(cents(' 1250,50 '),125050);assert.equal(cents('999999999,99'),99999999999);
  for(const value of ['0','-1','1.005','1.000,00','1e3','Infinity','NaN','1000000000',null,0])assert.throws(()=>cents(value));
});
test('valida datas reais e anos bissextos',()=>{
  assert.ok(validDate('2024-02-29'));assert.ok(validDate('2026-10-03'));
  for(const value of ['2026-02-29','2026-04-31','2026-13-01','2026-2-01','1999-01-01',null])assert.equal(validDate(value),false);
});
test('validadores recusam lançamentos inválidos',()=>{
  const body={type:'entrada',date:'2026-10-03',amount:'40,00',description:' Miniatura ',contact:' Lucas ',weight:'100,25'};
  assert.deepEqual(entry(body),{type:'entrada',date:'2026-10-03',amount:4000,description:'Miniatura',contact:'Lucas',weight:'100.25'});
  for(const patch of [{type:'outro'},{description:' '},{contact:[]},{weight:'0'},{weight:'-1'},{date:'2026-02-30'},{amount:'0'}])assert.throws(()=>entry({...body,...patch}));
  assert.equal(entry({...body,weight:''}).weight,null);
});
test('filtros usam parâmetros SQL e escapam curingas na busca',()=>{
  const search="50%_\\' OR 1=1 --";
  const result=filters({from:'2026-10-01',to:'2026-10-31',type:'entrada',search,page:'2'});
  assert.ok(!result.where.includes(search));assert.ok(result.where.includes('description ILIKE $4 OR contact ILIKE $4'));
  assert.equal(result.values[3],"%50\\%\\_\\\\' OR 1=1 --%");assert.equal(result.page,2);
  for(const query of [{from:'2026-10-31',to:'2026-10-01'},{page:'0'},{type:'all'},{search:[]}])assert.throws(()=>filters(query));
});
test('identificadores e versões válidos são obrigatórios',()=>{
  assert.equal(uuid('66177f37-33f2-4b7f-818c-a239bf89c273'),'66177f37-33f2-4b7f-818c-a239bf89c273');
  assert.throws(()=>uuid('1;DROP TABLE'));assert.throws(()=>version(0));assert.throws(()=>version('1'));assert.equal(version(1),1);
});
