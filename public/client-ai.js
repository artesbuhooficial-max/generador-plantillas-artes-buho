// La clave se envía sólo al servidor autenticado. No se guarda en HTML ni localStorage.
let officeSession=null, currentBatch='initial';
const initialVersions=versions.filter(v=>['original','banda','cercano','jugueton','directo','produccion'].includes(v.id));
async function api(route,body){
  const response=await fetch('./api/'+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('El asistente necesita el servidor de Artes Búho. Este enlace permite revisar y descargar las seis propuestas iniciales.');
  const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo completar la solicitud.');return result;
}
const originalShow=show;
show=which=>{const isAI=which==='ai';$('aiPanel').classList.toggle('hidden',!isAI);if(isAI){$('builder').classList.remove('active');$('comparison').classList.remove('active');$('tabBuild').classList.remove('active');$('tabCompare').classList.remove('active');window.scrollTo({top:0,behavior:'smooth'});}else originalShow(which);$('tabAI').classList.toggle('active',isAI);};
$('tabAI').onclick=()=>show('ai');
$('copyLink').onclick=async()=>{const link=new URL(location.href);if(currentBatch!=='initial')link.searchParams.set('batch',currentBatch);else link.searchParams.delete('batch');try{await navigator.clipboard.writeText(link.href);$('linkStatus').textContent='Enlace copiado. Puedes pegarlo en WhatsApp.';}catch{$('linkStatus').textContent=link.href;}};
$('downloadApp').onclick=()=>{
  const articles=versions.map((v,i)=>`<article><h2>${i+1}. ${esc(v.name)}</h2><p><b>Intención:</b> ${esc(v.intent)}</p><p><b>Qué implica:</b> ${esc(v.implication)}</p><iframe title="${esc(v.name)}" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(v.html)}"></iframe></article>`).join('');
  const resize="document.querySelectorAll('iframe').forEach(f=>f.onload=()=>{const d=f.contentDocument;const m=()=>f.style.height=Math.ceil(d.body.getBoundingClientRect().height)+'px';m();new ResizeObserver(m).observe(d.body);});";
  download(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Propuestas · Noches de Neón</title><style>body{margin:0;padding:20px;background:#eaf0f5;color:#0c2344;font-family:Arial}article{max-width:900px;margin:0 auto 35px;padding:20px;background:white;border-radius:24px}iframe{width:100%;border:0;height:1900px}p{line-height:1.5}</style></head><body><h1>Propuestas para revisar</h1>${articles}<script>${resize}<\/script></body></html>`,'propuestas-noches-de-neon.html');
};
function reviewsView(reviews){const box=$('teamReviews');box.replaceChildren();if(!reviews?.length)return;const title=document.createElement('h4');title.textContent='Opiniones de la oficina';box.append(title);for(const r of reviews){const p=document.createElement('p');const v=versions.find(v=>v.id===r.variantId);p.textContent=r.name+' · '+(v?.name||r.variantId)+(r.notes?' — '+r.notes:'');box.append(p);}}
async function loadBatches(){const data=await api('batches');const box=$('batchList');box.replaceChildren();const initial=document.createElement('button');initial.type='button';initial.className='small-btn';initial.textContent='Volver a las 6 propuestas iniciales';initial.onclick=()=>{versions.splice(0,versions.length,...initialVersions);currentBatch='initial';renderCards();renderGallery();reviewsView(data.reviews);history.replaceState({},'',location.pathname);show('compare');};box.append(initial);for(const b of data.batches.slice().reverse()){const row=document.createElement('div');row.className='button-row';const button=document.createElement('button');button.type='button';button.className='small-btn';button.textContent=new Date(b.createdAt).toLocaleString('es-ES')+' · '+b.summary.slice(0,110);button.onclick=()=>loadBatch(b.id);row.append(button);box.append(row);}if(currentBatch==='initial')reviewsView(data.reviews);}
function applyBatch(batch){
  currentBatch=batch.id;const imageMap=new Map(batch.images.map(x=>[x.index,x.src]));
  const items=batch.templates.map((t,i)=>{
    const fields={...t,audience:batch.audience,character:i===3?'juguetón':'personal',hero:'festival',heroData:imageMap.get(t.heroImage)||'',thumbs:true};
    return{id:'ai-'+batch.id+'-'+i,name:t.name,hook:t.headline,intent:t.intent,implication:t.implication,html:build(fields),filename:fileName(t.name),fields};
  });
  versions.splice(0,versions.length,...items);renderCards();renderGallery();reviewsView(batch.reviews||[]);
  $('aiSummary').classList.remove('hidden');$('aiSummary').textContent=batch.summary+(batch.missing.length?' · Por confirmar: '+batch.missing.join('; '):'');
  const url=new URL(location.href);url.searchParams.set('batch',batch.id);history.replaceState({},'',url);show('compare');
}
async function loadBatch(id){try{applyBatch(await api('batches/'+encodeURIComponent(id)));}catch(e){$('apiStatus').textContent=e.message;show('ai');}}
async function checkSession(){
  try{officeSession=await api('session');$('loginForm').classList.toggle('hidden',officeSession.authenticated||!officeSession.configured);$('logoutOffice').classList.toggle('hidden',!officeSession.authenticated);$('generateSix').disabled=!officeSession.aiReady;
    $('apiStatus').textContent=!officeSession.configured?'El servidor necesita una contraseña para la oficina.':!officeSession.authenticated?'Accede para generar propuestas y guardar opiniones compartidas.':!officeSession.aiReady?'Acceso correcto. Coloca la clave API en «Conexión GPT» para activar el asistente.':'Asistente conectado · '+officeSession.model+' · seis propuestas por tanda.';
    const canConfigure=officeSession.authenticated&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname));
    for(const id of ['openaiKey','openaiModel','saveOpenaiKey'])$(id).disabled=!canConfigure;
    $('openaiKey').value='';
    if(officeSession.model)$('openaiModel').value=officeSession.model;
    $('keyHelp').textContent=canConfigure?(officeSession.aiReady?'Ya hay una clave configurada. Puedes sustituirla aquí; nunca se mostrará la clave guardada.':'Pega la clave y pulsa «Guardar y comprobar conexión». Quedará sólo en el servidor.'):!officeSession.authenticated?'Accede con la contraseña de la oficina para colocar la clave.':'Necesitas abrir esta aplicación mediante HTTPS para colocar la clave.';
    $('sendReview').disabled=!officeSession.authenticated;
    if(officeSession.authenticated){await loadBatches();const id=new URL(location.href).searchParams.get('batch');if(id)await loadBatch(id);}
  }catch(e){officeSession=null;$('apiStatus').textContent='Modo revisión: las seis plantillas ya están disponibles. GPT y las opiniones compartidas se activarán cuando se conecte el servidor de Artes Búho.';$('sendReview').disabled=true;$('generateSix').disabled=true;for(const id of ['openaiKey','openaiModel','saveOpenaiKey'])$(id).disabled=true;$('openaiKey').value='';$('keyHelp').textContent='Este enlace de GitHub permite revisar plantillas. El campo de clave se activará en la versión conectada al servidor, después de acceder. No pegues la clave en el HTML.';$('feedbackStatus').textContent='Puedes copiar tu opinión y enviarla por WhatsApp. Este enlace aún no guarda opiniones compartidas.';}
}
$('openaiKeyForm').onsubmit=async e=>{
  e.preventDefault();const input=$('openaiKey'),button=$('saveOpenaiKey');
  if(!officeSession?.authenticated)return;
  button.disabled=true;$('keyStatus').textContent='Comprobando acceso a OpenAI…';
  try{const key=input.value.trim();input.value='';const result=await api('settings/openai',{key,model:F('openaiModel')});$('keyStatus').textContent=result.message+' Ya puedes generar las seis propuestas.';await checkSession();}
  catch(error){$('keyStatus').textContent=error.message;}
  finally{input.value='';button.disabled=!officeSession?.authenticated;}
};
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await api('login',{password:$('officePassword').value});$('officePassword').value='';await checkSession();}catch(error){$('apiStatus').textContent=error.message;}};
$('logoutOffice').onclick=async()=>{try{await api('logout',{});currentBatch='initial';versions.splice(0,versions.length,...initialVersions);renderCards();renderGallery();reviewsView([]);history.replaceState({},'',location.pathname);await checkSession();}catch(e){$('apiStatus').textContent=e.message;}};
$('aiFiles').onchange=()=>{$('fileSummary').textContent=[...$('aiFiles').files].map(f=>f.name+' ('+(f.size/1024/1024).toFixed(1)+' MB)').join(' · ');};
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer '+file.name));reader.readAsDataURL(file);});}
$('aiForm').onsubmit=async e=>{
  e.preventDefault();const button=$('generateSix');button.disabled=true;
  try{
    const files=[...$('aiFiles').files];if(files.length>8||files.some(f=>f.size>12*1024*1024)||files.reduce((n,f)=>n+f.size,0)>16*1024*1024)throw new Error('Máximo 8 archivos, 12 MB cada uno y 16 MB en total.');
    $('aiProgress').textContent='Leyendo los archivos y preparando las seis propuestas. Puede tardar unos minutos…';
    const attachments=await Promise.all(files.map(async f=>({name:f.name,data:await fileToBase64(f)})));
    const batch=await api('generate',{brief:F('aiBrief'),instructions:F('aiInstructions'),audience:F('aiAudience'),files:attachments});
    applyBatch(batch);await loadBatches();$('aiProgress').textContent='Las seis propuestas están guardadas. Comparadlas y elegid vuestra favorita.';
  }catch(error){$('aiProgress').textContent=error.message;}finally{button.disabled=!officeSession?.aiReady;}
};
$('sendReview').onclick=async()=>{const selected=document.querySelector('input[name="favorite"]:checked');if(!selected){$('feedbackStatus').textContent='Elige primero una plantilla favorita.';return;}try{await api('batches/'+currentBatch+'/reviews',{variantId:selected.value,name:F('reviewerName'),notes:F('feedbackNotes')});$('feedbackStatus').textContent='Opinión guardada para la oficina.';if(currentBatch==='initial')await loadBatches();else reviewsView((await api('batches/'+currentBatch)).reviews);}catch(e){$('feedbackStatus').textContent=e.message;}};
checkSession();
