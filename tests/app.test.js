import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateInput,validateResult,generateProposals} from '../ai.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ab-templates-test-'));
process.env.DATA_DIR=dir;process.env.APP_ACCESS_PASSWORD='test-password-only';process.env.COOKIE_SECURE='false';delete process.env.OPENAI_API_KEY;
const {server}=await import('../server.js');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
const post=(route,body,cookie,origin)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
test('El servidor protege API, mantiene la clave fuera del navegador y distingue falta de API',async()=>{
  assert.equal((await fetch(base+'/api/batches')).status,401);
  assert.equal((await post('/api/login',{password:'wrong'})).status,401);
  assert.equal((await post('/api/login',{password:'test-password-only'},null,'https://evil.example')).status,403);
  const login=await post('/api/login',{password:'test-password-only'});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const status=await (await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();assert.equal(status.authenticated,true);assert.equal(status.aiReady,false);
  assert.equal((await post('/api/generate',{brief:'Hola',files:[]},cookie)).status,503);
  assert.equal((await post('/api/batches/initial/reviews',{name:'Oficina',variantId:'produccion',notes:'Preferimos esta'},cookie)).status,200);
  const batches=await (await fetch(base+'/api/batches',{headers:{Cookie:cookie}})).json();assert.equal(batches.reviews[0].name,'Oficina');
  assert.equal((await fetch(base+'/.env')).status,400);
  await post('/api/logout',{},cookie);assert.equal((await fetch(base+'/api/batches',{headers:{Cookie:cookie}})).status,401);
});
test('Los adjuntos y el número de propuestas se validan',()=>{
  assert.throws(()=>validateInput({brief:'',files:[]}));assert.throws(()=>validateInput({brief:'Hola',files:[{name:'script.exe',data:'YWJj'}]}));
  assert.throws(()=>validateInput({brief:'Hola',files:Array.from({length:9},()=>({name:'a.png',data:'YWJj'}))}));
  assert.throws(()=>validateResult({summary:'x',missing:[],templates:[]}));
});
test('Una llamada lee imagen, PDF y audio y devuelve seis campos seguros',async()=>{
  const templates=Array.from({length:6},(_,i)=>Object.fromEntries(['name','subject','headline','greeting','opening','offer','proof','logistics','closing','cta','intent','implication'].map(k=>[k,k+String(i)]).concat([['structure','carta'],['heroImage',0]])));
  const calls=[];const fetcher=async(route,body)=>{calls.push({route,body});return route==='audio/transcriptions'?{text:'Cambiad el saludo'}:{output:[{content:[{type:'output_text',text:JSON.stringify({summary:'Seis propuestas',missing:[],templates})}]}]};};
  const input=validateInput({brief:'Banda real',audience:'municipal',files:[{name:'banda.png',data:'YWJj'},{name:'dossier.pdf',data:'YWJj'},{name:'voz.mp3',data:'YWJj'}]});
  const result=await generateProposals(input,{key:'mock-only',model:'mock-model',fetcher});assert.equal(result.templates.length,6);
  const request=calls.find(x=>x.route==='responses').body;assert.equal(request.store,false);assert.equal(request.text.format.strict,true);assert.equal(request.text.format.schema.properties.templates.minItems,6);
  const content=request.input[0].content;assert.ok(content.some(x=>x.type==='input_image'));assert.ok(content.some(x=>x.type==='input_file'));assert.ok(content.some(x=>x.type==='input_text'&&x.text.includes('Cambiad el saludo')));
});
test('El formulario comprueba y guarda la clave sólo en el servidor autenticado',async()=>{
  const key='sk-'+'mockTestOnly'.repeat(5);
  assert.equal((await post('/api/settings/openai',{key,model:'gpt-4.1'})).status,401);
  const login=await post('/api/login',{password:'test-password-only'});const cookie=login.headers.get('set-cookie');
  assert.equal((await post('/api/settings/openai',{key:'no-key',model:'gpt-4.1'},cookie)).status,400);
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>String(url).startsWith('https://api.openai.com/')?new Response(JSON.stringify({id:'gpt-4.1'}),{status:200,headers:{'Content-Type':'application/json'}}):nativeFetch(url,options);
  try{
    const result=await post('/api/settings/openai',{key,model:'gpt-4.1'},cookie);assert.equal(result.status,200);assert.ok(!(await result.text()).includes(key));
    const status=await (await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();assert.equal(status.aiReady,true);assert.ok(!JSON.stringify(status).includes(key));
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'openai-private.json'),'utf8')).key,key);
    assert.equal((await fetch(base+'/data/openai-private.json')).status,400);
    assert.ok(!(await (await fetch(base+'/')).text()).includes(key));
    globalThis.fetch=async(url,options)=>String(url).startsWith('https://api.openai.com/')?new Response('{}',{status:401}):nativeFetch(url,options);
    assert.equal((await post('/api/settings/openai',{key:'sk-'+'invalidMockOnly'.repeat(4),model:'gpt-4.1'},cookie)).status,400);
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'openai-private.json'),'utf8')).key,key);
  }finally{globalThis.fetch=nativeFetch;}
});
