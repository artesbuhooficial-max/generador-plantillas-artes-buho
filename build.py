"""Empaqueta los correos aprobados sin incluir audio, datos ni credenciales."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent
packed=json.loads((root/'source/seed.json').read_text(encoding='utf-8'))
page=(root/'source/base.html').read_text(encoding='utf-8')
page=page.replace('grid-template-columns:repeat(auto-fit,minmax(235px,1fr))','grid-template-columns:repeat(3,minmax(0,1fr))')
page=page.replace('@media(max-width:990px){','@media(max-width:990px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}')
page=page.replace('@media(max-width:580px){','@media(max-width:580px){.cards{grid-template-columns:1fr}')
page=page.replace('Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight)','doc.body.getBoundingClientRect().height')
page=page.replace('__PACKED__',json.dumps(packed,separators=(',',':')))
page=page.replace('cinco','seis').replace('Cinco','Seis')
page=page.replace("\n];\nconst decoder",",\n {id:'produccion',name:'Producción fácil',hook:'«Vosotros ponéis la fecha. Hablemos del resto»',intent:'Facilitar la organización y resolver la producción.',implication:'Encaja con equipos que necesitan concretar montaje, sonido y medios antes de reservar.'}\n];\nconst decoder",1)
page=page.replace('<button id="tabBuild"','<button id="tabAI" type="button">Asistente GPT · 6 propuestas</button><button id="tabBuild"',1)
start=page.index('    <div class="share-panel">')
end=page.index('    <div class="section-heading">',start)
page=page[:start]+'''    <div class="share-panel"><h2>Un enlace para decidir juntos</h2><p>Recorre las seis propuestas completas. Cada una explica su intención. Puedes descargar el comparador o copiar el enlace para enviarlo a la oficina.</p><div class="button-row"><button class="btn-primary" id="copyLink" type="button">Copiar enlace</button><button class="btn-secondary" id="downloadApp" type="button">Descargar las propuestas juntas</button></div><p id="linkStatus" class="status"></p></div>\n'''+page[end:]
page=page.replace('<div class="feedback"><h3>','<div class="feedback"><h3>',1).replace('<textarea id="feedbackNotes"','<label class="field"><span>Tu nombre, para la revisión compartida</span><input id="reviewerName" maxlength="80" autocomplete="name"></label><textarea id="feedbackNotes"',1)
page=page.replace('<button type="button" class="btn-primary" id="copyFeedback">','<button type="button" class="btn-primary" id="sendReview">Guardar opinión en la oficina</button><button type="button" class="btn-secondary" id="copyFeedback">',1)
page=page.replace('<p class="status" id="feedbackStatus"></p>','<p class="status" id="feedbackStatus"></p><div id="teamReviews"></div>',1)
page=page.replace('<main>','<main>\n'+(root/'ai-panel.html').read_text(encoding='utf-8'),1)
page=page.replace("frame.setAttribute('scrolling','no');","frame.setAttribute('scrolling','no');frame.setAttribute('sandbox','allow-same-origin allow-popups allow-popups-to-escape-sandbox');",1)
page=page.replace('assets[f.hero]||assets.festival','f.heroData||assets[f.hero]||assets.festival')
head,tail=page.rsplit('</body>',1)
page=head+'<script src="client-ai.js"></script>\n</body>'+tail
for folder in ['public','docs']:
    dest=root/folder;dest.mkdir(exist_ok=True)
    (dest/'index.html').write_text(page,encoding='utf-8')
    (dest/'client-ai.js').write_text((root/'client-ai.js').read_text(encoding='utf-8'),encoding='utf-8')
    (dest/'.nojekyll').write_text('')
print('App empaquetada: seis propuestas; servidor y GitHub Pages.')
