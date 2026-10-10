import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';

const cash=value=>{const n=BigInt(value),a=n<0n?-n:n;return `${n<0n?'- ':''}R$ ${(a/100n).toLocaleString('pt-BR')},${String(a%100n).padStart(2,'0')}`;};
const date=value=>value?value.split('-').reverse().join('/'):'Sem limite';
const C={ink:rgb(.09,.10,.10),muted:rgb(.36,.36,.36),gray:rgb(.96,.96,.96),white:rgb(1,1,1),line:rgb(.8,.8,.8),dark:rgb(.09,.12,.13),orange:rgb(.96,.65,.32),green:rgb(.04,.68,.49),red:rgb(.90,.39,.36)};

export async function buildPDF(rows,meta){
  const doc=await PDFDocument.create();doc.setTitle('Hefestus Maker - Relatório de Gastos e Receitas');
  const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const logo=await doc.embedPng(await readFile(new URL('../public/logo.png',import.meta.url)));
  const W=595.28,H=841.89,M=40,BOTTOM=795,CW=W-M*2;let page,y;const pages=[];
  const safe=value=>Array.from(String(value??'')).map(c=>{if(c==='\n')return c;if(c==='\t')return ' ';try{font.encodeText(c);return c;}catch{return '?';}}).join('');
  function text(value,x,top,size=10,face=font,color=C.muted){page.drawText(safe(value),{x,y:H-top-size,size,font:face,color});}
  function rect(x,top,width,height,color,border=false){page.drawRectangle({x,y:H-top-height,width,height,color,...(border?{borderWidth:.4,borderColor:C.line}:{})});}
  function wrap(value,width,size=10,face=font){
    const lines=[];
    for(const part of safe(value).split('\n')){
      let line='';for(const word of part.split(' ')){
        const candidate=line?line+' '+word:word;
        if(face.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
        if(line){lines.push(line);line='';}
        for(const char of word){if(face.widthOfTextAtSize(line+char,size)>width&&line){lines.push(line);line='';}line+=char;}
      }lines.push(line);
    }return lines;
  }
  function newPage(){
    page=doc.addPage([W,H]);pages.push(page);page.drawImage(logo,{x:M,y:H-82,width:42,height:42});
    text('Hefestus Maker',94,41,18,bold,C.ink);text('Relatório de Gastos e Receitas',94,66,11);
    text(`Período: ${date(meta.from)} até ${date(meta.to)}`,M,102);text(`Gerado em: ${meta.generated} (São Paulo)`,M,116);y=135;
    if(meta.type||meta.search){const label=`Filtros: ${meta.type==='entrada'?'receitas':meta.type==='saida'?'gastos':'todos os tipos'}${meta.search?' | Busca: '+meta.search:''}`;for(const l of wrap(label,CW,9)){text(l,M,y,9);y+=12;}y+=5;}
    if(meta.example){text('EXEMPLO - DADOS FICTÍCIOS',M,y,8,bold,C.muted);y+=15;}
  }
  // Cabeçalhos repetidos e linhas divididas em páginas sem cortar descrições extensas.
  function table(title,headers,widths,data,color,{border=false}={}){
    const size=10,lineHeight=13,pad=6;
    function heading(continued=false){
      text(title+(continued?' (continuação)':''),M,y,12,bold,C.ink);y+=22;
      let x=M;headers.forEach((h,i)=>{rect(x,y,widths[i],24,color);text(h,x+pad,y+5,10,bold,color===C.orange?C.ink:C.white);x+=widths[i];});y+=24;
    }
    const firstLines=data.length?Math.max(...data[0].map((v,i)=>wrap(v,widths[i]-pad*2,size).length)):1;
    if(y+46+Math.min(firstLines,40)*lineHeight+pad*2>BOTTOM)newPage();heading();
    if(!data.length)data=[headers.map((_,i)=>i===0?'Nenhum registro':'')];
    data.forEach((cells,index)=>{
      const lines=cells.map((cell,i)=>wrap(cell,widths[i]-pad*2,size)),maxLines=Math.max(...lines.map(v=>v.length));let offset=0;
      while(offset<maxLines){
        let capacity=Math.floor((BOTTOM-y-pad*2)/lineHeight);
        if(capacity<1){newPage();heading(true);capacity=Math.floor((BOTTOM-y-pad*2)/lineHeight);}
        const remaining=maxLines-offset;
        // Mantenha linhas normais inteiras quando cabem em uma página nova.
        if(offset===0&&remaining>capacity&&remaining<=40&&y>220){newPage();heading(true);capacity=Math.floor((BOTTOM-y-pad*2)/lineHeight);}
        const take=Math.min(remaining,capacity),height=take*lineHeight+pad*2;let x=M;
        cells.forEach((_,i)=>{rect(x,y,widths[i],height,index%2===0?C.gray:C.white,border);for(let l=0;l<take;l++){const value=lines[i][offset+l];if(value!==undefined)text(value,x+pad,y+pad+l*lineHeight,size);}x+=widths[i];});
        y+=height;offset+=take;if(offset<maxLines){newPage();heading(true);}
      }
    });y+=16;
  }
  const incoming=rows.filter(r=>r.type==='entrada'),outgoing=rows.filter(r=>r.type==='saida');
  const sum=items=>items.reduce((total,r)=>total+BigInt(r.amount_cents),0n),received=sum(incoming),spent=sum(outgoing);
  newPage();table('Resumo do período',['Total de Receitas','Total de Gastos','Saldo'],[CW*.39,CW*.36,CW*.25],[[cash(received),cash(spent),cash(received-spent)]],C.dark,{border:true});
  const groups=new Map();for(const r of outgoing){const name=r.category?.trim()||'Sem categoria';groups.set(name,(groups.get(name)||0n)+BigInt(r.amount_cents));}
  const categories=[...groups].sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0],'pt-BR'):a[1]>b[1]?-1:1).map(([name,total])=>{const ratio=spent?(total*1000n+spent/2n)/spent:0n;return[name,cash(total),`${ratio/10n},${ratio%10n}%`];});
  table('Gastos por categoria',['Categoria','Total','% do total de gastos'],[CW*.40,CW*.25,CW*.35],categories,C.orange);
  const description=r=>[r.description,r.contact?'Cliente / fornecedor: '+r.contact:'',r.weight_grams!=null?'Peso: '+String(r.weight_grams).replace('.',',')+' g':''].filter(Boolean).join('\n');
  table('Receitas',['Data','Descrição','Valor'],[65,CW-175,110],incoming.map(r=>[date(r.date),description(r),cash(r.amount_cents)]),C.green);
  table('Gastos',['Data','Descrição','Categoria','Valor'],[65,CW-280,105,110],outgoing.map(r=>[date(r.date),description(r),r.category?.trim()||'Sem categoria',cash(r.amount_cents)]),C.red);
  pages.forEach((p,i)=>p.drawText(`Hefestus Maker - página ${i+1} de ${pages.length}`,{x:M,y:19,size:8,font:bold,color:rgb(.6,.6,.6)}));
  return doc.save();
}
