/* Agente IA: transcripción de voz + calificación literal del PEP (estilo INEP) + guion de paciente.
   Depende de globals de index.html (G, tab, view, $, esc, byId, mark, pushA, pushD, send, render, remain, go). */
let TR=[],AI=null,rec=null,recOn=false,interim="",segN=0,micErr="";
let cfg={provider:"gemini",keys:{anthropic:"",gemini:"",openai:""},base:"https://api.groq.com/openai/v1",
 models:{anthropic:{live:"claude-sonnet-5-5",fin:"claude-opus-5-5"},gemini:{live:"gemini-2.5-flash",fin:"gemini-2.5-flash"},openai:{live:"llama-3.3-70b-versatile",fin:"llama-3.3-70b-versatile"}},
 every:40,liveOn:true,mic:true,lang:"pt-BR",remember:false};
try{const o=JSON.parse(localStorage.getItem("rvp2_cfg"))||{};if(o.key&&!o.keys){o.keys={anthropic:o.key};o.provider="anthropic"}
 Object.assign(cfg,o);cfg.keys=Object.assign({anthropic:"",gemini:"",openai:""},o.keys);cfg.models=Object.assign({},cfg.models,o.models)}catch(e){}
{const D={anthropic:{live:"claude-sonnet-5-5",fin:"claude-opus-5-5"},gemini:{live:"gemini-2.5-flash",fin:"gemini-2.5-flash"},openai:{live:"llama-3.3-70b-versatile",fin:"llama-3.3-70b-versatile"}};
 if(!["anthropic","gemini","openai"].includes(cfg.provider))cfg.provider="gemini";
 cfg.every=Math.min(300,Math.max(20,+cfg.every||40));cfg.lang=["pt-BR","es-419"].includes(cfg.lang)?cfg.lang:"pt-BR";
 if(typeof cfg.base!=="string"||!/^https?:\/\//.test(cfg.base))cfg.base="https://api.groq.com/openai/v1";
 for(const p in D){const m=(cfg.models&&cfg.models[p])||{};cfg.models[p]={live:String(m.live||D[p].live).slice(0,80),fin:String(m.fin||D[p].fin).slice(0,80)};if(typeof cfg.keys[p]!=="string")cfg.keys[p]=""}}
const saveCfg=()=>{try{const o=JSON.parse(JSON.stringify(cfg));if(!cfg.remember){sessionStorage.setItem("rvp2_keys",JSON.stringify(cfg.keys));o.keys={anthropic:"",gemini:"",openai:""}}localStorage.setItem("rvp2_cfg",JSON.stringify(o))}catch(e){}};
if(!cfg.remember){try{Object.assign(cfg.keys,JSON.parse(sessionStorage.getItem("rvp2_keys"))||{})}catch(e){}}
const mmss=t=>String(t/60|0).padStart(2,"0")+":"+String(t%60).padStart(2,"0");
const hasKey=()=>cfg.provider==="openai"?(!!cfg.keys.openai||/localhost|127\.0\.0\.1/.test(cfg.base)):!!cfg.keys[cfg.provider];

/* ---------- voz ---------- */
function micWant(){return !!G&&cfg.mic&&G.A.phase==="run"&&G.role!=="?"}
function micCheck(){const w=micWant();if(w&&!recOn)micStart();else if(!w&&recOn)micStop()}
function micStart(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){micErr="Este navegador no tiene reconocimiento de voz. Usa Chrome o Edge.";return}
 micErr="";rec=new SR();rec.lang=cfg.lang;rec.continuous=true;rec.interimResults=true;
 rec.onresult=e=>{let it="";for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)addSeg(r[0].transcript.trim());else it+=r[0].transcript}interim=it;const el=$("#interim");if(el)el.textContent=it};
 rec.onend=()=>{if(recOn)try{rec.start()}catch(x){}};
 rec.onerror=e=>{dbg("voz: "+e.error);
  if(e.error==="not-allowed"||e.error==="service-not-allowed"){micErr="Micrófono/voz bloqueado por el navegador. Permítelo en el candado de la barra de direcciones.";micStop()}
  else if(e.error==="audio-capture"){micErr="No se encuentra un micrófono.";micStop()}
  else if(e.error==="network"){micErr="El servicio de voz del navegador no responde (¿sin internet?). Se reintenta solo.";setTimeout(()=>{micErr=""},8000)}
  /* no-speech / aborted: normal, se reinicia solo en onend */};
 recOn=true;try{rec.start()}catch(x){}}
function micStop(){recOn=false;try{rec&&rec.stop()}catch(x){}rec=null;interim=""}
function addSeg(x){if(!x||!G)return;const w=G.role==="ator"?"ator":"medico";const seg={id:w+(++segN)+"_"+Date.now(),w,t:Math.max(0,G.A.dur-remain()),x};TR.push(seg);if(TR.length>800)TR.shift();send({t:"T",v:seg});if(view==="sala"&&tab==="tr")render()}
function trLines(){return TR.length?TR.map(x=>`<div class="item small"><span class="mut">[${mmss(x.t)}]</span> <b>${x.w==="ator"?"ACTOR":"MÉDICO"}:</b> ${esc(x.x)}</div>`).join(""):"<span class='mut'>Aún no hay transcripción.</span>"}
function trCard(){return `<div class="card"><h3 style="margin-top:0">Transcripción en vivo</h3><div class="small mut" style="margin-bottom:8px">Cada navegador transcribe su propio micrófono y lo comparte. Usen audífonos para que el micrófono no capte la voz de la otra persona.</div>${trLines()}<div class="small mut" id="interim">${esc(interim)}</div></div>`}

/* ---------- prompts ---------- */
const SYS=`Eres un evaluador del examen Revalida INEP (2ª etapa, estación práctica). Califica al candidato (MÉDICO) usando ÚNICAMENTE el PEP (checklist) entregado, de forma LITERAL y ESTRICTA, como lo haría un evaluador del INEP.
Reglas:
1. Solo cuenta lo que el MÉDICO dijo, según la transcripción. Lo que dice el ACTOR/paciente nunca da puntos.
2. Aplica el criterio de cada ítem tal como está escrito (Adequado / Parcialmente adequado / Inadequado) con sus umbrales numéricos. Cuenta únicamente los elementos enumerados en el ítem, o los equivalentes que el propio ítem acepta con "ou/OU/e/ou". Nada fuera de esa lista suma.
3. Las acciones "solicita", "prescreve", "verbaliza", "pergunta", "orienta" deben estar dichas de forma inequívoca. Intenciones vagas, preguntas genéricas ("¿algo más?") o enumeraciones incompletas no cuentan.
4. Ante duda razonable, la categoría inferior. Sin benevolencia. Solo hay crédito parcial cuando el criterio "Parcialmente adequado" del ítem lo describe.
5. Respeta las restricciones de las instrucciones de la estación (máximo de exámenes, orden, solo los primeros N, etc.).
6. La transcripción viene de reconocimiento automático de voz y puede deformar términos médicos. Si un término está deformado pero el contexto lo hace inequívoco, puedes aceptarlo y marcar duvida=true. Si no es inequívoco, no cuentes.
7. Por cada ítem devuelve: i (índice dado), k (0 = inadecuado, 1 = parcialmente adecuado, 2 = adecuado; si el ítem solo tiene niveles Adecuado/Inadecuado usa 0 o 1), evid (citas literales cortas del MÉDICO con su [mm:ss]; vacío si no hay), cuenta (qué contaste, p. ej. "preguntó 4 de 10: início, irradiação, ..."), faltou (qué faltó para el nivel superior, citando el criterio; vacío si ya es el máximo), duvida.
8. Si el modo es EN VIVO la estación sigue en curso: califica solo con lo dicho hasta ahora; lo no dicho aún queda en k=0 con faltou="aún no verbalizado".
Devuelve un ítem por cada ítem del PEP. Responde solo con el JSON del esquema. Textos en español; las citas, en portugués tal cual fueron dichas.`;
const SCHEMA={type:"object",properties:{items:{type:"array",items:{type:"object",properties:{i:{type:"integer"},k:{type:"integer"},evid:{type:"string"},cuenta:{type:"string"},faltou:{type:"string"},duvida:{type:"boolean"}},required:["i","k","evid","cuenta","faltou","duvida"],additionalProperties:false}},resumen:{type:"string"}},required:["items","resumen"],additionalProperties:false};
function buildPrompt(s,final){
 const imp=G.A.rel.imp.map(i=>s.impressos[i]).filter(Boolean).map(im=>"## "+im.titulo+"\n"+(im.texto||"")+(im.imagen?"\n[imagen entregada]":"")).join("\n\n")||"(ninguno aún)";
 const pep=s.itens.map((it,i)=>({i,n:it.n,texto:it.t,adequado:it.a,parcialmente_adequado:it.p,inadequado:it.i,puntos_por_nivel:it.pts,niveles:it.pts.length}));
 const tr=TR.map(x=>`[${mmss(x.t)}] ${x.w==="ator"?"ACTOR/PACIENTE":"MÉDICO"}: ${x.x}`).join("\n").slice(-60000)||"(sin transcripción)";
 return `MODO: ${final?"FINAL (la estación terminó)":"EN VIVO (la estación sigue en curso)"}\n\nINSTRUCCIONES DE LA ESTACIÓN:\n${s.instrucoes}\n\nIMPRESOS ENTREGADOS AL MÉDICO:\n${imp}\n\nPEP (checklist):\n${JSON.stringify(pep)}\n\nTRANSCRIPCIÓN:\n${tr}`}

/* ---------- llamada al proveedor (directo desde el navegador) ---------- */
const parseJ=t=>{try{return JSON.parse(t)}catch(e){const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1));throw new Error("La IA no devolvió JSON válido")}};
const gem=s=>{if(Array.isArray(s)||typeof s!=="object"||s===null)return s;const o={};for(const k in s){if(k==="additionalProperties")continue;if(k==="type")o[k]=String(s[k]).toUpperCase();else if(k==="properties")o[k]=Object.fromEntries(Object.entries(s[k]).map(([a,b])=>[a,gem(b)]));else o[k]=gem(s[k])}return o};
const httpErr=(r,j)=>{const m=(j&&j.error&&(j.error.message||j.error))||("HTTP "+r.status);const e=new Error(String(m).slice(0,300));e.status=r.status;return e};
const sleepMs=ms=>new Promise(r=>setTimeout(r,ms));
/* Gemini: si el nombre del modelo ya no existe (404), consulta la lista y elige un "flash" vigente */
async function geminiFix(){try{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);
 const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",{headers:{"x-goog-api-key":cfg.keys.gemini},signal:ac.signal});clearTimeout(t);const j=await r.json().catch(()=>({}));
 const l=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/flash/.test(m.name)&&!/lite|preview|exp|image|tts|live|audio|thinking/.test(m.name)).map(m=>m.name.replace(/^models\//,"")).sort().reverse();
 if(l.length&&l[0]!==cfg.models.gemini.live){dbg("modelo Gemini cambiado: "+cfg.models.gemini.live+" -> "+l[0]);cfg.models.gemini.live=cfg.models.gemini.fin=l[0];saveCfg();return true}}catch(e){dbg("geminiFix falló: "+e.message)}return false}
/* con tiempo límite y reintentos solo en fallos transitorios (429/5xx/red); 401/403/404/400 no se reintentan */
async function llm(o){const tmo=o.final?60000:25000,max=o.final?3:1;let last;
 for(let n=0;n<max;n++){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),tmo);
  try{return await llmOnce(o,ac.signal)}
  catch(e){last=e;if(e&&e.name==="AbortError"){last=new Error("La IA no respondió a tiempo ("+tmo/1000+" s)");last.transient=true}
   const st=last.status||0;dbg("IA falló ("+cfg.provider+") "+(st||"")+" "+String(last.message).slice(0,120));
   if(cfg.provider==="gemini"&&st===404&&!o.__fixed){o.__fixed=true;if(await geminiFix()){n--;continue}}
   const retry=last.transient||st===429||st>=500||last instanceof TypeError;if(!retry||n>=max-1)break;await sleepMs(1500*Math.pow(2,n)+Math.random()*500)}
  finally{clearTimeout(t)}}
 throw last}
async function llmOnce({system,user,schema,final},signal){
 const p=cfg.provider,m=cfg.models[p],model=final?m.fin:m.live,key=cfg.keys[p];let r,j;
 if(p==="anthropic"){
  r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal,headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
   body:JSON.stringify({model,max_tokens:8000,system,messages:[{role:"user",content:user}],output_config:{effort:final?"high":"medium",format:{type:"json_schema",schema}}})});
  j=await r.json().catch(()=>({}));if(!r.ok)throw httpErr(r,j);
  if(j.stop_reason==="refusal")throw new Error("El modelo rechazó la solicitud (refusal).");if(j.stop_reason==="max_tokens")throw new Error("Respuesta cortada (max_tokens).");
  return{data:parseJ(j.content.filter(b=>b.type==="text").map(b=>b.text).join("")),usage:{i:j.usage.input_tokens,o:j.usage.output_tokens}}}
 if(p==="gemini"){
  r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal,headers:{"content-type":"application/json","x-goog-api-key":key},
   body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:user}]}],generationConfig:{responseMimeType:"application/json",responseSchema:gem(schema),temperature:0,maxOutputTokens:8192}})});
  j=await r.json().catch(()=>({}));if(!r.ok)throw httpErr(r,j);
  const c=j.candidates&&j.candidates[0];if(!c||!c.content)throw new Error("Gemini no devolvió contenido ("+((c&&c.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||"?")+")");
  const u=j.usageMetadata||{};return{data:parseJ(c.content.parts.map(x=>x.text||"").join("")),usage:{i:u.promptTokenCount,o:u.candidatesTokenCount}}}
 /* openai-compatible: Groq, OpenRouter, Ollama, LM Studio… */
 const h={"content-type":"application/json"};if(key)h.authorization="Bearer "+key;
 r=await fetch(cfg.base.replace(/\/$/,"")+"/chat/completions",{method:"POST",signal,headers:h,body:JSON.stringify({model,temperature:0,response_format:{type:"json_object"},
  messages:[{role:"system",content:system},{role:"user",content:user+"\n\nResponde SOLO con un objeto JSON que cumpla este esquema: "+JSON.stringify(schema)}]})});
 j=await r.json().catch(()=>({}));if(!r.ok)throw httpErr(r,j);
 const u=j.usage||{};return{data:parseJ(j.choices[0].message.content),usage:{i:u.prompt_tokens,o:u.completion_tokens}}}
const errMsg=e=>{const m=String((e&&e.message)||e),st=(e&&e.status)||0;
 if(st===401||st===403||(/API key|api_key|unauthor|permission/i.test(m)&&st<500&&st!==429))return "Key inválida o sin permiso. Revísala en ⚙ Agente IA. ("+m.slice(0,100)+")";
 if(st===404)return "Modelo no encontrado: cambia el nombre en ⚙ Agente IA. ("+m.slice(0,100)+")";
 if(st===429||/quota|RESOURCE_EXHAUSTED/i.test(m))return "Límite del plan alcanzado; se reintenta en la siguiente pasada. ("+m.slice(0,100)+")";
 if(e instanceof TypeError||/Failed to fetch|NetworkError/i.test(m))return "Sin conexión con la IA (internet, bloqueo del navegador o dirección no permitida). Mira 🩺 Diagnóstico.";
 return m}

/* ---------- calificación (en segundo plano, sin mostrar nota) ---------- */
function aiSilent(){const s=byId(G.sid);s.itens.forEach((_,i)=>{const r=AI.res[i];if(r&&!(G.A.man&&G.A.man[i]))G.A.pep[i]=r.k})}
async function aiRun(final){if(!G||G.role==="medico"||!hasKey())return;
 if(AI&&AI.busy){if(final)AI.pend=true;return}
 if(!TR.length&&!final)return;const s=byId(G.sid);
 AI=Object.assign(AI||{res:{}},{busy:true,err:"",final:!!final});const quiet=()=>!final&&G.A.phase==="run"&&tab!=="tr";if(!quiet())render();
 try{const r=await llm({system:SYS,user:buildPrompt(s,final),schema:SCHEMA,final});
  if(!final&&G.A.phase!=="run"){AI.busy=false}
  else{const res={};(r.data.items||[]).forEach(x=>{const it=s.itens[x.i];if(!it)return;const mx=it.pts.length===3?2:1;res[x.i]={k:Math.max(0,Math.min(mx,x.k|0)),evid:x.evid||"",cuenta:x.cuenta||"",faltou:x.faltou||"",duvida:!!x.duvida}});
   AI.res=res;AI.resumen=r.data.resumen||"";AI.usage=r.usage;AI.n=TR.length;AI.at=Date.now();AI.busy=false;aiSilent();
   if(final){G.A.ai={res:AI.res,resumen:AI.resumen,final:true};pushA()}}}
 catch(e){AI.busy=false;AI.err=errMsg(e)}
 if(AI.pend){AI.pend=false;return aiRun(true)}
 if(!quiet())render()}
function aiTick(){if(!G||G.role!=="ator"||!hasKey()||!cfg.liveOn||G.A.phase!=="run")return;const n=Date.now();if(n-(aiTick.last||0)<cfg.every*1000)return;aiTick.last=n;if((AI?AI.n:-1)!==TR.length)aiRun(false)}
function aiApply(i){const r=AI&&AI.res[i];if(!r)return;mark(i,r.k);render()}
function aiApplyAll(){const s=byId(G.sid);G.A.man={};s.itens.forEach((_,i)=>{const r=AI&&AI.res[i];if(r)G.A.pep[i]=r.k});pushA();render()}

/* ---------- UI de calificación ---------- */
function aiChip(i,editable){const R=editable?(AI&&AI.res):(G.A.ai&&G.A.ai.res);const r=R&&R[i];if(!r)return"";const s=byId(G.sid),three=s.itens[i].pts.length===3,L=three?["Inadecuado","Parcial","Adecuado"]:["Inadecuado","Adecuado"];
 return `<div class="small" style="margin:6px 0;padding:8px;border-left:3px solid var(--pri);background:var(--bg)">🤖 <b>${editable?"Sugerencia":"Agente"}: ${L[Math.min(r.k,L.length-1)]}</b>${r.duvida?' <span class="crit">⚠ dudoso (posible error de voz)</span>':""}<div>${esc(r.cuenta)}</div>${r.evid?`<div class="mut">${esc(r.evid)}</div>`:""}${r.faltou?`<div><b>Faltó:</b> ${esc(r.faltou)}</div>`:""}${editable&&G.A.pep[i]!==r.k?`<button class="g" style="margin-top:4px" onclick="aiApply(${i})">Aplicar</button>`:""}</div>`}
function aiBar(){if(G.role==="medico")return"";
 if(!hasKey())return `<div class="warn" style="margin-bottom:12px">🤖 Agente IA desactivado: configúralo en <a href="#" onclick="go('cfg');return false">⚙ Agente IA</a> (hay opciones gratis).</div>`;
 const ph=G.A.phase;
 if(ph==="run"||ph==="paused"||ph==="idle")return `<div class="small mut" style="margin-bottom:10px">🤖 Corrigiendo en segundo plano. La nota no se muestra hasta el final.${AI&&AI.err?` <span class="crit">⚠ ${esc(AI.err)}</span>`:""}</div>`;
 const u=AI&&AI.usage,busy=AI&&AI.busy;
 return `<div class="card"><div class="row"><b class="grow">🤖 Agente evaluador (literal, estilo INEP)</b><button class="b" onclick="aiRun(true)" ${busy?"disabled":""}>Recalificar</button>${AI&&AI.res&&Object.keys(AI.res).length?`<button class="g" onclick="if(confirm('¿Sobrescribir también tus marcas manuales con las de la IA?'))aiApplyAll()">Aplicar todas</button>`:""}</div>
 <div class="small mut" style="margin-top:6px">${busy?"⏳ Calificando…":AI&&AI.at?`Pasada ${AI.final?"final":"parcial"} · ${AI.n} segmentos${u&&u.i?` · ${u.i} tok entrada / ${u.o} salida`:""}`:(TR.length?"Esperando la calificación final…":"No hubo transcripción: califica manualmente.")}</div>
 ${AI&&AI.err?`<div class="warn" style="margin-top:6px">Error: ${esc(AI.err)}</div>`:""}${AI&&AI.resumen?`<div class="small" style="margin-top:6px">${esc(AI.resumen)}</div>`:""}</div>`}
function flagTog(i){if(G.D.flags[i])delete G.D.flags[i];else G.D.flags[i]={txt:""};pushD();render()}
function flagTxt(i,v){if(G.D.flags[i])G.D.flags[i].txt=v;clearTimeout(flagTxt.t);flagTxt.t=setTimeout(pushD,400)}
function reviewDoc(s){const A=G.A,ai=A.ai&&A.ai.res;
 return `<div class="card"><h3 style="margin-top:0">Revisión conjunta (sin nota)</h3><div class="small mut">La IA calificó en segundo plano. Revisen juntos lo que se le escapó o malinterpretó. Si crees que dijiste algo que no se tomó en cuenta, márcalo con 🚩 y tu compañera decide. La nota se muestra al final.</div>${ai?"":`<div class="warn" style="margin-top:8px">⏳ Esperando la calificación del agente… (si no hay IA configurada, tu compañera califica manualmente)</div>`}</div>`+
 s.itens.map((it,i)=>{const f=G.D.flags[i];
  return `<div class="card"><div><b>${it.n}.</b> ${esc(it.t)}</div><div class="small mut">${it.a?`<b>A:</b> ${esc(it.a)}<br>`:""}${it.p?`<b>P:</b> ${esc(it.p)}<br>`:""}${it.i?`<b>I:</b> ${esc(it.i)}`:""}</div>${ai?aiChip(i,false):""}<div class="row" style="margin-top:6px"><button class="${f?"b":"g"}" onclick="flagTog(${i})">🚩 ${f?"Marcado":"Creo que sí lo dije"}</button></div>${f?`<input id="fl${i}" placeholder="¿Qué dijiste / en qué minuto?" value="${esc(f.txt)}" oninput="flagTxt(${i},this.value)" style="margin-top:6px">`:""}</div>`}).join("")+
 (TR.length?`<details class="card"><summary style="cursor:pointer">Transcripción</summary>${trLines()}</details>`:"")}

/* ---------- guion del paciente ---------- */
let GS={};try{const o=JSON.parse(localStorage.getItem("rvp2_gs"))||{};for(const k in o)if(Array.isArray(o[k]))GS[k]=o[k].slice(0,80).map(x=>String(x).slice(0,400))}catch(e){}
let gsBusy=false,gsErr="";
const GSYS=`Eres guionista de pacientes simulados para el examen Revalida INEP (2ª etapa). Escribe las respuestas que el paciente/acompañante simulado dará cuando el médico pregunte, coherentes con la descripción del caso, las instrucciones, los impresos y lo que el PEP espera que el médico pregunte.
Reglas: no inventes hallazgos que contradigan los impresos; no reveles el diagnóstico; cubre datos personales (nombre, edad, profesión, estado civil), historia de la enfermedad actual, síntomas asociados que el PEP pide explorar (incluye los negativos relevantes), antecedentes, medicamentos, alergias, hábitos, antecedentes familiares y contexto social; una frase corta por respuesta, en portugués coloquial brasileño, en primera persona; no ofrezcas información que no se pregunte. Devuelve solo el JSON del esquema.`;
const GSCHEMA={type:"object",properties:{respuestas:{type:"array",items:{type:"string"}}},required:["respuestas"],additionalProperties:false};
async function genScript(){const s=byId(G.sid);if(gsBusy||!hasKey())return;gsBusy=true;gsErr="";render();
 const imp=s.impressos.map(im=>"## "+im.titulo+"\n"+(im.texto||"")).join("\n\n");
 const pep=s.itens.map(it=>`${it.n}. ${it.t} | A: ${it.a} | P: ${it.p}`).join("\n");
 try{const r=await llm({system:GSYS,user:`DESCRIPCIÓN DEL CASO:\n${s.descricao||"(no publicada)"}\n\nSÍNTESIS DEL INEP:\n${s.sinteseTexto||"(no publicada)"}\n\nINSTRUCCIONES AL CANDIDATO:\n${s.instrucoes}\n\nIMPRESOS:\n${imp}\n\nPEP:\n${pep}`,schema:GSCHEMA,final:true});
  GS[s.id]=r.data.respuestas||[];try{localStorage.setItem("rvp2_gs",JSON.stringify(GS))}catch(e){}}catch(e){gsErr=errMsg(e)}
 gsBusy=false;render()}
function pacHtml(s){const g=GS[s.id];
 return `<div class="card"><h3 style="margin-top:0">Lo que el paciente puede responder</h3>${s.ator.length?`<span class="tag">Guion oficial INEP</span><ul>${s.ator.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="small mut">Responde solo si el médico pregunta adecuadamente. No ofrezcas información espontánea.</div>`:
  `<div class="warn">El INEP no publicó el guion del paciente para esta estación (${esc(ed(s.edicao))}). ${s.sinteseTexto?"Abajo tienes la síntesis completa del INEP.":"En las ediciones hasta 2022.2 solo publicó instrucciones, impresos y PEP."} Puedes generar un guion complementario con IA o probar otra estación.</div><button class="b" onclick="otraConGuion()">🔀 Otra estación con guion oficial</button>`}</div>
 ${g?`<div class="card"><span class="tag">⚠ Generado por IA, no oficial</span><h3>Guion complementario</h3><ul>${g.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="small mut">Revísalo contra los impresos; si algo contradice un resultado, manda el impreso.</div><button class="g" style="margin-top:8px" onclick="genScript()" ${gsBusy?"disabled":""}>Regenerar</button></div>`:
  `<div class="card">${hasKey()?`<button class="b" onclick="genScript()" ${gsBusy?"disabled":""}>${gsBusy?"⏳ Generando…":"Generar guion complementario con IA (no oficial)"}</button>`:`<span class="small mut">Configura el agente IA (hay opciones gratis) para generar un guion de respuestas.</span>`}${gsErr?`<div class="warn" style="margin-top:6px">${esc(gsErr)}</div>`:""}</div>`}
 ${s.sinteseTexto?`<details class="card"><summary style="cursor:pointer"><b>Síntesis completa del INEP</b> (orientaciones al avaliador)</summary><pre style="margin-top:8px">${esc(s.sinteseTexto)}</pre></details>`:""}`}

/* ---------- configuración ---------- */
function cfgPage(){const p=cfg.provider,m=cfg.models[p],opt=(v,l)=>`<option ${v===l?"selected":""}>${l}</option>`;
 $("#app").innerHTML=`<div class="card"><h3 style="margin-top:0">Agente IA</h3>
 <label>Proveedor</label><select onchange="cfg.provider=this.value;saveCfg();cfgPage()"><option value="gemini" ${p==="gemini"?"selected":""}>Google Gemini (plan gratuito)</option><option value="openai" ${p==="openai"?"selected":""}>Compatible OpenAI: Groq, OpenRouter, Ollama… (gratis)</option><option value="anthropic" ${p==="anthropic"?"selected":""}>Anthropic Claude (de pago)</option></select>
 ${p==="openai"?`<label>URL base</label><input value="${esc(cfg.base)}" onchange="cfg.base=this.value.trim();saveCfg()"><div class="row" style="margin-top:6px"><button class="g" onclick="cfg.base='https://api.groq.com/openai/v1';cfg.models.openai={live:'llama-3.3-70b-versatile',fin:'llama-3.3-70b-versatile'};saveCfg();cfgPage()">Groq</button><button class="g" onclick="cfg.base='https://openrouter.ai/api/v1';cfg.models.openai={live:'meta-llama/llama-3.3-70b-instruct:free',fin:'meta-llama/llama-3.3-70b-instruct:free'};saveCfg();cfgPage()">OpenRouter (:free)</button><button class="g" onclick="cfg.base='http://localhost:11434/v1';cfg.models.openai={live:'llama3.1:8b',fin:'llama3.1:8b'};saveCfg();cfgPage()">Ollama local</button></div>`:""}
 <label>API key ${p==="openai"?"(vacía para Ollama local)":""} · se guarda solo en este navegador</label><input type="password" value="${esc(cfg.keys[p])}" placeholder="${p==="gemini"?"AIza…":p==="anthropic"?"sk-ant-…":"gsk_… / sk-or-…"}" onchange="cfg.keys['${p}']=this.value.trim();saveCfg()">
 <div class="row"><div class="grow"><label>Modelo en vivo</label><input value="${esc(m.live)}" onchange="cfg.models['${p}'].live=this.value.trim();saveCfg()"></div><div class="grow"><label>Modelo calificación final</label><input value="${esc(m.fin)}" onchange="cfg.models['${p}'].fin=this.value.trim();saveCfg()"></div>
 <div style="width:120px"><label>Idioma de voz</label><select onchange="cfg.lang=this.value;saveCfg()">${["pt-BR","es-419"].map(x=>opt(x,cfg.lang)).join("")}</select></div></div>
 <label>Califica en segundo plano cada (segundos)</label><input type="number" min="20" value="${cfg.every}" style="width:100px" onchange="cfg.every=Math.max(20,+this.value||40);saveCfg()">
 <label style="margin-top:12px"><input type="checkbox" style="width:auto" ${cfg.remember?"checked":""} onchange="cfg.remember=this.checked;saveCfg()"> Recordar la key en este navegador (menos seguro en una PC compartida; si no, se borra al cerrar la pestaña)</label>
 <label><input type="checkbox" style="width:auto" ${cfg.liveOn?"checked":""} onchange="cfg.liveOn=this.checked;saveCfg()"> Corregir en segundo plano durante la estación (sin mostrar nota)</label>
 <label><input type="checkbox" style="width:auto" ${cfg.mic?"checked":""} onchange="cfg.mic=this.checked;saveCfg()"> Transcribir mi voz durante la estación</label>
 <div class="row" style="margin-top:12px"><button class="b" onclick="cfgTest()">Probar conexión</button><span id="cfgres" class="small"></span></div></div>
 <div class="card small"><b>Opciones gratis (verifica límites vigentes en cada sitio; cambian seguido):</b><br>• <b>Google Gemini:</b> crea una key gratis en Google AI Studio. Es la más fácil. En el plan gratuito Google puede usar tus prompts para mejorar sus productos. Si da error de modelo, cambia el nombre en el campo.<br>• <b>Groq:</b> plan gratuito con límites por minuto y por día; con transcripciones largas puede dar error 429.<br>• <b>Ollama (en tu PC):</b> gratis y privado, pero necesita un equipo potente y arrancar Ollama con <code>OLLAMA_ORIGINS=*</code>. Los modelos pequeños califican peor que los grandes.<br>• Los modelos gratis suelen ser menos estrictos que Claude: por eso hay revisión conjunta al final.</div>
 <div class="card small mut"><b>Privacidad y límites:</b> Chrome/Edge transcriben tu voz con el servicio de voz del navegador. El texto y la llave viajan directo a ${p==="anthropic"?"Anthropic":p==="gemini"?"Google":"el servidor que indiques"}, sin servidor intermedio. La calificación es una sugerencia, no la del INEP. Si publicas la app, cada persona usa su propia llave; nunca la escribas en el código.</div>`}
async function cfgTest(){const e=$("#cfgres");e.textContent="⏳…";try{const r=await llm({system:"Responde solo JSON.",user:'Devuelve {"ok":true}',schema:{type:"object",properties:{ok:{type:"boolean"}},required:["ok"],additionalProperties:false},final:false});e.textContent=r.data.ok?"✅ Conectado":"Respuesta inesperada"}catch(x){e.textContent="❌ "+errMsg(x)}}
