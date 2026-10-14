import {IncomingMessage,ServerResponse} from 'node:http';
import {Duplex} from 'node:stream';

// Injeta requisições HTTP no Express sem abrir portas nem usar rede.
export function inject(app,{path='/',method='GET',body,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const socket=new Duplex({highWaterMark:16*1024*1024,read(){},write(chunk,encoding,callback){callback();}});socket.remoteAddress='127.0.0.1';
    const request=new IncomingMessage(socket);request.method=method;request.url=path;request.httpVersion='1.1';request.complete=true;
    const payload=body===undefined?null:JSON.stringify(body);
    request.headers={host:'localhost:3000',...headers,...(payload?{'content-type':'application/json','content-length':String(Buffer.byteLength(payload))}:{})};
    const response=new ServerResponse(request),chunks=[];response.assignSocket(socket);
    const originalWrite=response.write.bind(response),originalEnd=response.end.bind(response);
    response.write=(chunk,...args)=>{if(chunk)chunks.push(Buffer.from(chunk));return originalWrite(chunk,...args);};
    response.end=(chunk,...args)=>{if(chunk)chunks.push(Buffer.from(chunk));return originalEnd(chunk,...args);};
    const timer=setTimeout(()=>{socket.destroy();reject(new Error('Requisição de teste não terminou: '+method+' '+path));},5000);
    response.on('finish',()=>{clearTimeout(timer);const text=Buffer.concat(chunks).toString();resolve({status:response.statusCode,headers:response.getHeaders(),text,json:()=>JSON.parse(text)});socket.destroy();});
    response.on('error',error=>{clearTimeout(timer);reject(error);});
    app(request,response);if(payload)request.push(payload);request.push(null);
  });
}
