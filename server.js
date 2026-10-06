import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateInput,generateProposals} from './ai.js';
try { process.loadEnvFile(); } catch(error) { if(error.code!=='ENOENT') throw error; }
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
await fs.mkdir(dataDir,{recursive:true});
const keyFile=path.join(dataDir,'openai-private.json');
let savedOpenAI={};
try{savedOpenAI=JSON.parse(await fs.readFile(keyFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const apiKey=()=>savedOpenAI.key||process.env.OPENAI_API_KEY||'';
const apiModel=()=>savedOpenAI.model||process.env.OPENAI_MODEL||'gpt-4.1';
const sessions=new Map(), attempts=new Map();
let busy=false;
const secure=process.env.COOKIE_SECURE!=='false';
const equal=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(),crypto.createHash('sha256').update(b).digest());
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function readBody(req){let count=0;const chunks=[];for await(const chunk of req){count+=chunk.length;if(count>24*1024*1024){const e=new Error('La solicitud supera 24 MB.');e.status=413;throw e;}chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Solicitud JSON inválida.');}}
async function readStore(){try{return JSON.parse(await fs.readFile(path.join(dataDir,'store.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return{batches:[],reviews:[],usage:{}};throw e;}}
let store=await readStore();
let writeQueue=Promise.resolve();
function save(){const snapshot=JSON.stringify(store);const task=writeQueue.then(async()=>{await fs.writeFile(path.join(dataDir,'store.tmp'),snapshot);await fs.rename(path.join(dataDir,'store.tmp'),path.join(dataDir,'store.json'));});writeQueue=task.catch(()=>{});return task;}
function authorized(req){const token=/\bab_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1];const expiry=sessions.get(token);return !!expiry && expiry>Date.now();}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET' && url.pathname==='/health')return json(res,200,{ok:true});
    if(url.pathname.startsWith('/api/')){
      if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Método no permitido.'});
      if(req.method==='POST'){
        const origin=req.headers.origin;
        if(origin && new URL(origin).host!==req.headers.host)return json(res,403,{error:'Origen no permitido.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Se requiere JSON.'});
      }
      if(url.pathname==='/api/session' && req.method==='GET')return json(res,200,{authenticated:authorized(req),configured:!!process.env.APP_ACCESS_PASSWORD,aiReady:authorized(req)&&!!apiKey(),model:authorized(req)?apiModel():null});
      if(url.pathname==='/api/login' && req.method==='POST'){
        if(!process.env.APP_ACCESS_PASSWORD)return json(res,503,{error:'El servidor necesita APP_ACCESS_PASSWORD.'});
        const ip=req.socket.remoteAddress,now=Date.now();const attempt=attempts.get(ip)||{count:0,until:now+15*60*1000};
        if(attempt.until<now){attempt.count=0;attempt.until=now+15*60*1000;}attempt.count++;attempts.set(ip,attempt);
        if(attempt.count>15)return json(res,429,{error:'Espera quince minutos antes de volver a acceder.'});
        const body=await readBody(req);
        if(typeof body.password!=='string'||!equal(body.password,process.env.APP_ACCESS_PASSWORD))return json(res,401,{error:'Contraseña incorrecta.'});
        attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,now+12*60*60*1000);
        res.setHeader('Set-Cookie',`ab_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`);return json(res,200,{ok:true});
      }
      if(!authorized(req))return json(res,401,{error:'Accede con la contraseña de la oficina.'});
      if(url.pathname==='/api/settings/openai' && req.method==='POST'){
        const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'');
        if(!local&&!req.socket.encrypted&&req.headers['x-forwarded-proto']!=='https')return json(res,403,{error:'Para guardar una clave necesitas una conexión HTTPS.'});
        const body=await readBody(req);
        if(typeof body.key!=='string'||!/^sk-[A-Za-z0-9_-]{20,500}$/.test(body.key.trim())||typeof body.model!=='string'||!/^gpt-[A-Za-z0-9._-]{1,100}$/.test(body.model.trim()))return json(res,400,{error:'Introduce una clave API válida y el identificador del modelo GPT.'});
        if(busy)return json(res,409,{error:'Espera a que termine la generación antes de cambiar la configuración.'});
        const key=body.key.trim(),model=body.model.trim();
        // Comprobación de acceso sin generar contenido ni devolver la clave.
        let response;
        try{response=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});}catch{return json(res,502,{error:'No se pudo comprobar la conexión con OpenAI. La clave no se ha guardado.'});}
        if(!response.ok)return json(res,400,{error:response.status===401?'OpenAI no reconoce esta clave. No se ha guardado.':response.status===404?'El modelo no existe o esta cuenta no tiene acceso. No se ha guardado.':'OpenAI no permite comprobar este modelo. La clave no se ha guardado.'});
        try{await fs.writeFile(keyFile+'.tmp',JSON.stringify({key,model}),{mode:0o600});await fs.rename(keyFile+'.tmp',keyFile);}catch{return json(res,500,{error:'No se pudo guardar la configuración privada en el servidor.'});}
        savedOpenAI={key,model};return json(res,200,{ok:true,model,message:'Clave guardada en el servidor. Acceso al modelo comprobado.'});
      }
      if(url.pathname==='/api/logout' && req.method==='POST'){const token=/\bab_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1];sessions.delete(token);res.setHeader('Set-Cookie','ab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
      if(url.pathname==='/api/batches' && req.method==='GET')return json(res,200,{batches:store.batches.map(b=>({id:b.id,createdAt:b.createdAt,summary:b.summary})),reviews:store.reviews.filter(r=>r.batchId==='initial')});
      if(url.pathname==='/api/generate' && req.method==='POST'){
        if(!apiKey())return json(res,503,{error:'La API de Artes Búho aún no está configurada. Guarda la clave en la sección de conexión GPT.'});
        if(busy)return json(res,409,{error:'Hay otra generación en curso. Espera a que termine.'});
        const day=new Date().toISOString().slice(0,10),used=store.usage[day]||0;
        if(used>=Number(process.env.MAX_GENERATIONS_PER_DAY||30))return json(res,429,{error:'Se ha alcanzado el límite diario de generaciones.'});
        const input=validateInput(await readBody(req));busy=true;
        try{
          store.usage[day]=used+1;await save();
          const result=await generateProposals(input,{key:apiKey(),model:apiModel()});
          const batch={id:crypto.randomUUID(),createdAt:new Date().toISOString(),...result,audience:input.audience,images:input.files.map((f,index)=>f.mime.startsWith('image/')?{index,name:f.name,src:`data:${f.mime};base64,${f.data}`}:null).filter(Boolean)};
          store.batches.push(batch);await save();return json(res,200,batch);
        }finally{busy=false;}
      }
      const match=/^\/api\/batches\/([a-zA-Z0-9-]+)(\/reviews)?$/.exec(url.pathname);
      if(match){
        const id=match[1],batch=store.batches.find(b=>b.id===id);
        if(id!=='initial'&&!batch)return json(res,404,{error:'No existe esta tanda.'});
        if(req.method==='GET'&&!match[2])return json(res,200,{...batch,reviews:store.reviews.filter(r=>r.batchId===id)});
        if(req.method==='POST'&&match[2]){
          const body=await readBody(req);const validIds=id==='initial'?['original','banda','cercano','jugueton','directo','produccion']:batch.templates.map((_,i)=>'ai-'+id+'-'+i);
          if(!validIds.includes(body.variantId)||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||typeof body.notes!=='string'||body.notes.length>3000)return json(res,400,{error:'Completa el nombre y elige una plantilla válida.'});
          const review={id:crypto.randomUUID(),batchId:id,variantId:body.variantId,name:body.name.trim(),notes:body.notes,createdAt:new Date().toISOString()};
          store.reviews.push(review);await save();return json(res,200,review);
        }
      }
      return json(res,404,{error:'Ruta no encontrada.'});
    }
    if(req.method!=='GET')return json(res,405,{error:'Método no permitido.'});
    const fileName=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
    const publicDir=path.join(root,'public'),target=path.resolve(publicDir,fileName);
    if(!target.startsWith(publicDir+path.sep))return json(res,403,{error:'Acceso no permitido.'});
    const file=await fs.readFile(target);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(file);
  }catch(e){json(res,e.status||400,{error:e.code==='ENOENT'?'Archivo no encontrado.':e.name==='TimeoutError'?'La generación tardó demasiado. Vuelve a intentarlo.':e.message||'No se pudo completar la solicitud.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Generador disponible en el puerto '+(process.env.PORT||3000)));
setInterval(()=>{const now=Date.now();for(const[k,v]of sessions)if(v<now)sessions.delete(k);for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);},60000).unref();
