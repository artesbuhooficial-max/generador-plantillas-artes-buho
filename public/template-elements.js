let uploadedTemplateLogo='';
let logoReadPromise=null;
function readTemplateLayout(){return {logo:uploadedTemplateLogo,logoPosition:F('logoPosition'),unsubscribe:true,unsubscribeURL:F('unsubscribeURL'),unsubscribeLabel:F('unsubscribeLabel')||'Darme de baja'};}
function restoreTemplateLayout(layout){uploadedTemplateLogo=layout.logo||'';$('logoPosition').value=layout.logoPosition||'right';$('includeUnsubscribe').checked=true;$('unsubscribeURL').value=layout.unsubscribeURL||'';$('unsubscribeLabel').value=layout.unsubscribeLabel||'Darme de baja';renderLogoPreview();}
function renderLogoPreview(){$('logoPreview').innerHTML=uploadedTemplateLogo?`<img alt="Logo de cabecera" src="${esc(uploadedTemplateLogo)}" style="max-width:160px;max-height:100px;object-fit:contain;background:white;padding:10px">`:'';}
function renderTemplateElements(html,layout,campaign){
 layout=layout||{};
 if(layout.logo){
  const align=['left','center','right'].includes(layout.logoPosition)?layout.logoPosition:'right';
  if(campaign==='bella'&&html.includes('data-template-header="bella"')){
   const brand=`<td width="78" valign="middle"><img src="${esc(assets.brand)}" width="66" height="66" alt="Artes Búho" style="display:block;width:66px;height:66px;border:0"></td>`;
   const title='<td valign="middle" style="padding:0 12px"><span style="font-size:23px;font-family:Georgia,serif;color:#f2d5a4">Bella <i>&</i> Bestia</span><br><span style="font-size:9px;letter-spacing:2px;color:#fff">SALA PRIVADA · MADRID</span></td>';
   const logo=`<td width="110" align="${align}" valign="middle"><img src="${esc(layout.logo)}" width="100" height="66" alt="Logo de la empresa" style="display:block;width:100px;height:66px;object-fit:contain;border:0"></td>`;
   const cells=align==='left'?logo+title+brand:align==='center'?brand+logo+title:brand+title+logo;
   const header=`<tr data-template-header="bella"><td style="background:#271d2e;padding:22px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;
   html=html.replace(/<tr data-template-header="bella">[\s\S]*?<\/table><\/td><\/tr>/,header);
  }else{
   const row=`<tr><td align="${align}" style="padding:16px 24px;background:white"><img src="${esc(layout.logo)}" width="120" alt="Logo de la empresa" style="display:block;width:120px;max-width:100%;height:auto;border:0"></td></tr>`;html=html.replace(/(max-width:600px[^>]*>)/, '$1'+row);
  }
 }
 return ensureUnsubscribe(html,layout,campaign);
}
function ensureUnsubscribe(html,layout={},campaign='neon'){
 // Replace our own footer when settings change; preserve a working legacy link.
 html=html.replace(/<tr data-template-unsubscribe="mandatory">[\s\S]*?<\/tr>/gi,'');
 if(/<a\b[^>]*href=["'][^"']+["'][^>]*>\s*(?:Darme de baja|Darse de baja|Cancelar suscripción)\s*<\/a>/i.test(html))return html;
 const email=campaign==='bella'?'salabellabestia@gmail.com':'contratacion@artesbuho.com';
 const href=layout.unsubscribeURL||'mailto:'+email+'?subject=Solicitud%20de%20baja';
 const row=`<tr data-template-unsubscribe="mandatory"><td align="center" style="padding:24px;background:#f5f5f5"><a href="${esc(href)}" style="display:inline-block;border:1px solid #777;border-radius:999px;padding:10px 18px;color:#444;font-size:13px;text-decoration:none">${esc(layout.unsubscribeLabel||'Darme de baja')}</a>${layout.unsubscribeURL?'':'<p style="font-size:11px;color:#666">Abre un correo para solicitar la baja.</p>'}</td></tr>`;
 const end=/<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/body>/i;
 if(end.test(html))return html.replace(end,match=>row+match);
 const footer=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row}</table>`;
 return /<\/body>/i.test(html)?html.replace(/<\/body>/i,footer+'</body>'):html+footer;
}
const elementBaseBuild=build;
build=f=>renderTemplateElements(elementBaseBuild(f),f.layout,f.campaign||'neon');
const elementCollect=collect;
collect=()=>({...elementCollect(),layout:readTemplateLayout()});
$('templateLogo').onchange=()=>{logoReadPromise=(async()=>{const file=$('templateLogo').files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Usa PNG, JPG o WebP de hasta 2 MB.');$('elementStatus').textContent='Leyendo el logo…';const data=await fileToBase64(file);uploadedTemplateLogo='data:'+file.type+';base64,'+data;renderLogoPreview();$('elementStatus').textContent='Logo listo. Pulsa Aplicar para verlo en las plantillas.';})();logoReadPromise.catch(e=>{$('elementStatus').textContent=e.message;});};
$('removeTemplateLogo').onclick=()=>{uploadedTemplateLogo='';logoReadPromise=null;$('templateLogo').value='';renderLogoPreview();};
$('applyTemplateElements').onclick=async()=>{const button=$('applyTemplateElements');button.disabled=true;try{if(logoReadPromise)await logoReadPromise;const layout=readTemplateLayout();for(const v of versions){if(v.fields){v.fields.layout=layout;v.html=build(v.fields);}else{v.elementOriginalHTML??=v.html;v.html=renderTemplateElements(v.elementOriginalHTML,layout,activeCampaign);}}renderCards();renderGallery();renderDraft();const message=layout.logo?'Logo incrustado y aplicado a las '+versions.length+' propuestas.':'Configuración aplicada. No hay un logo cargado; usa «Subir logo para la cabecera» para añadirlo.';$('elementStatus').textContent=message;$('campaignNote').textContent=message+' Descarga las plantillas para conservar este cambio.';show('compare');document.querySelector('#gallery .review-item')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){$('elementStatus').textContent='No se pudo aplicar: '+e.message;}finally{button.disabled=false;}};

// Normalize every loaded version, including seed emails and old saved drafts.
const elementBaseRenderGallery=renderGallery;
renderGallery=()=>{for(const v of versions)v.html=ensureUnsubscribe(v.html,v.fields?.layout||{},v.fields?.campaign||activeCampaign);elementBaseRenderGallery();};
renderGallery();renderDraft();
