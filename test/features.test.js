import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {buildExcel,buildPDF} from '../src/reports.js';
import {validateOrder} from '../src/features.js';
const meta={from:'2026-01-01',to:'2026-12-31',type:'',search:'',generated:'04/10/2026 10:00:00'};
const rows=[{date:'2026-10-04',type:'entrada',description:'=HYPERLINK("não executar") & peça <PLA>',contact:'João',weight_grams:'100.25',amount_cents:'4010'},{date:'2026-10-04',type:'saida',description:'Material',contact:'',weight_grams:null,amount_cents:'1050'}];
test('XLSX contém todos os registros, números, filtros e textos sem fórmulas',async()=>{
  const zip=await JSZip.loadAsync(await buildExcel(rows,meta));const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet,/inlineStr/);assert.match(sheet,/=HYPERLINK/);assert.match(sheet,/&amp; peça &lt;PLA&gt;/);assert.match(sheet,/<v>40.1<\/v>/);assert.match(sheet,/<v>10.5<\/v>/);assert.match(sheet,/<v>29.6<\/v>/);assert.match(sheet,/A5:G7/);assert.ok(!sheet.includes('<f>'));
  const empty=await JSZip.loadAsync(await buildExcel([],meta));assert.match(await empty.file('xl/worksheets/sheet1.xml').async('string'),/A5:G5/);
});
test('PDF real suporta multipáginas, acentos, descrições extensas e conjunto vazio',async()=>{
  const input=Array.from({length:30},()=>({...rows[0],description:'Descrição longa de impressão. '.repeat(50)+' 🔧'}));
  const bytes=await buildPDF(input,meta);assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
  const doc=await PDFDocument.load(bytes);assert.ok(doc.getPageCount()>2);
  assert.equal((await PDFDocument.load(await buildPDF([],meta))).getPageCount(),1);
});
test('pedidos validam etapa, valor opcional, peso e prazo',()=>{
  const body={status:'orcamento',description:'Peça',contact:'',amount:'',weight:'',dueDate:''};
  assert.equal(validateOrder(body).amount,null);assert.equal(validateOrder({...body,amount:'80,50',dueDate:'2026-10-31'}).amount,8050);
  for(const patch of [{status:'errado'},{dueDate:'2026-02-30'},{amount:'0'},{weight:'-1'},{description:' '}])assert.throws(()=>validateOrder({...body,...patch}));
});
