# Generador de plantillas HTML para mails · Artes Búho

Aplicación de revisión y asistente multimodal para Sala Bella Bestia y Noches de Neón.

**Aplicación con servidor:** https://plantillas.187.127.82.1.sslip.io/

Bella Bestia dispone de seis prototipos editoriales: invitación personal, complicidad atrevida, catering, participación del equipo, prueba visual y coordinación. Los enlaces de YouTube y sus rótulos se editan antes de generar. Las miniaturas corresponden al ID del vídeo; no se deduce su contenido. Cada tanda conserva campaña, vídeos, imágenes y modelo.

La generación usa GPT 5.6 Sol por defecto, con opciones GPT 6 Sol, GPT 6 Astra y GPT 6.1 Sol. No hay cambio automático a un modelo inferior; el acceso y saldo dependen de la cuenta API. Los prototipos iniciales son textos preparados para revisar, no resultados de una llamada de pago a GPT.

## Compartir con la oficina

**Comparador público:** https://artesbuhooficial-max.github.io/generador-plantillas-artes-buho/

Incluye seis propuestas completas, una debajo de otra, con intención y criterio de elección. Se puede descargar cada correo, exportar todas las propuestas en un HTML con imágenes incrustadas y copiar una opinión para WhatsApp.

**Estado de GPT:** el código de integración está preparado, pero GitHub Pages sólo sirve archivos estáticos. Allí no hay servidor, clave API ni generación real. Para activar GPT y guardar revisiones compartidas, desplegar este repositorio en el servidor de Artes Búho y configurar las variables siguientes. No introducir la clave en GitHub Pages, HTML, JavaScript del navegador ni el chat.

## Asistente multimodal

- Texto e indicaciones libres.
- PNG, JPG, WebP: lectura visual; elección de portada entre las imágenes aportadas.
- PDF: texto e imágenes; DOCX, PPTX, TXT, Markdown, CSV y XLSX mediante entradas de archivo de la API.
- MP3, MP4, M4A, WAV y WebM: transcripción de la voz. No analiza fotogramas de vídeo.
- Una generación produce exactamente seis enfoques: prueba visual, escala y solvencia, carta cercana, juguetón, caso concreto y producción fácil.
- Devuelve información pendiente para confirmar, sin inventar méritos ni copiar la identidad de Rubén Cotton. Se utiliza un patrón de redacción personal; no se ha entrenado un modelo nuevo.
- El HTML se compone con un renderizador fijo y texto escapado. El modelo no ejecuta código ni envía correos.
- En servidor: acceso por contraseña, sesiones HttpOnly, límite diario, una generación simultánea, tandas y opiniones compartidas.

Los correos de partida conservan logos, dos miniaturas de vídeo y datos de Noches de Neón facilitados por David. Las imágenes incrustadas sirven para revisión y compartir archivos; para envío masivo se deben alojar en HTTPS y usar la baja de la plataforma de envío. No hay garantía de entrega por elegir un formato de imagen.

## Arranque local (Node 22 o superior)

1. Copiar `.env.example` a `.env`.
2. Configurar `APP_ACCESS_PASSWORD`, `OPENAI_API_KEY` y el modelo autorizado en esa cuenta (`OPENAI_MODEL`). En local, `COOKIE_SECURE=false`; en producción HTTPS, `true`.
3. Ejecutar `npm start`; abrir http://localhost:3000.
4. Acceder desde «Asistente GPT · 6 propuestas». Adjuntar la información y pulsar «Generar las 6 plantillas».

También se puede colocar la clave en **Asistente GPT → Conexión GPT → Clave API de GPT de Artes Búho**, tras acceder a la versión con servidor. «Guardar y comprobar conexión» comprueba el acceso al modelo en OpenAI y guarda la clave en `data/openai-private.json`, fuera del HTML público y excluido de Git. No muestra ni devuelve la clave guardada. En producción se necesita HTTPS. El campo está desactivado en GitHub Pages. La clave guardada desde el formulario tiene prioridad sobre `OPENAI_API_KEY`; el modelo seleccionado debe admitir visión y salidas estructuradas. La comprobación de acceso no confirma saldo ni sustituye una prueba real de generación.

Sin clave se pueden revisar las seis propuestas iniciales y editar borradores con el motor local. No se sustituye GPT por una simulación.

## Despliegue en Coolify

Crear una aplicación desde este repositorio usando el Dockerfile incluido. Puerto interno: `3000`; healthcheck: `/health`. Asignar un dominio HTTPS propio y un volumen persistente en `/app/data`.

Variables privadas **sólo de runtime**:

| Variable | Uso |
| --- | --- |
| `OPENAI_API_KEY` | Clave de un proyecto API de Artes Búho |
| `OPENAI_MODEL` | Modelo con visión y Structured Outputs; por defecto `gpt-5.6-sol` |
| `APP_ACCESS_PASSWORD` | Contraseña compartida con los revisores |
| `COOKIE_SECURE` | `true` en producción HTTPS |
| `DATA_DIR` | `/app/data` |
| `MAX_GENERATIONS_PER_DAY` | `30` por defecto; también limita intentos fallidos que llaman al proveedor |

No reutilizar ni modificar las aplicaciones de emailing existentes. Esta aplicación es independiente. Configurar un presupuesto del proyecto en OpenAI. Cada solicitud envía texto y adjuntos a OpenAI; las respuestas usan `store:false`. Esto no equivale a prometer retención cero en el proveedor.

La app guarda las tandas, las imágenes seleccionables y opiniones en el volumen del servidor. No guarda los documentos o audio de entrada. No borrar el volumen al redesplegar. Las opiniones se guardan como registros; no constituyen votación certificada ni identificación individual. Reiniciar cierra las sesiones.

## Código y verificación

`server.js`: servidor y acceso. `ai.js`: API Responses, transcripción y esquema de seis propuestas. `client-ai.js`: formulario y revisión. `build.py`: recompila la aplicación desde `source/base.html`, `source/seed.json`, el panel y los clientes `client-ai.js` y `campaigns.js`. Ejecutar `python build.py` después de editar esas fuentes. Las salidas están versionadas en `public` y `docs`; Docker no necesita Python ni archivos externos. `OPENAI_TRANSCRIBE_MODEL` permite configurar el modelo de transcripción (por defecto `gpt-transcribe`).

`npm test` verifica acceso, límites de adjuntos, seis propuestas y peticiones multimodales con un proveedor simulado. No consume saldo de OpenAI. Una prueba real requiere la clave API; no se ha ejecutado mientras falta.

Referencias: [entradas de archivo](https://developers.openai.com/api/docs/guides/file-inputs), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
