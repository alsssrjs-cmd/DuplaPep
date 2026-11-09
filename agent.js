/* Ayuda del actor (v1.3): transcripción de voz del navegador + buscador y resaltado LOCAL.
   Sin IA, sin llaves, sin instalar nada. Depende de globals de index.html (G, tab, view, $, esc, byId, nrm, send, render, remain, rel). */
let TR=[],rec=null,recOn=false,interim="",segN=0,micErr="";
const cfg={lang:"pt-BR",mic:true};
try{const o=JSON.parse(localStorage.getItem("rvp2_cfg"))||{};if(o.lang==="es-419")cfg.lang="es-419";if(o.mic===false)cfg.mic=false}catch(e){}
/* limpieza: la versión anterior podía dejar llaves de IA guardadas; se borran */
const saveCfg=()=>{try{localStorage.setItem("rvp2_cfg",JSON.stringify({lang:cfg.lang,mic:cfg.mic}))}catch(e){}};
try{saveCfg();sessionStorage.removeItem("rvp2_keys")}catch(e){}
const mmss=t=>String(t/60|0).padStart(2,"0")+":"+String(t%60).padStart(2,"0");
function setLang(v){cfg.lang=v==="es-419"?"es-419":"pt-BR";saveCfg();micStop();render()}
function togMic(){cfg.mic=!cfg.mic;saveCfg();if(!cfg.mic)micStop();render()}
function voiceCtl(){return `<select onchange="setLang(this.value)" title="Idioma en que habla el médico" style="width:auto;padding:5px"><option value="pt-BR" ${cfg.lang==="pt-BR"?"selected":""}>🎙 Portugués</option><option value="es-419" ${cfg.lang==="es-419"?"selected":""}>🎙 Español</option></select><button class="g" onclick="togMic()" title="Activar o apagar el reconocimiento de voz">${cfg.mic?"🎙 Voz activa":"🔇 Voz apagada"}</button>`}

/* ---------- voz (la del navegador, Chrome/Edge) ---------- */
function micWant(){return !!G&&cfg.mic&&G.A.phase==="run"&&G.role!=="?"}
function micCheck(){const w=micWant();if(w&&!recOn)micStart();else if(!w&&recOn)micStop()}
function micStart(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){micErr="Este navegador no tiene reconocimiento de voz. Usa Chrome o Edge (el buscador de texto funciona igual).";return}
 micErr="";rec=new SR();rec.lang=cfg.lang;rec.continuous=true;rec.interimResults=true;
 rec.onresult=e=>{let it="";for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)addSeg(r[0].transcript.trim());else it+=r[0].transcript}interim=it;document.querySelectorAll(".interim").forEach(el=>{el.textContent=it})};
 rec.onend=()=>{if(recOn)try{rec.start()}catch(x){}};
 rec.onerror=e=>{dbg("voz: "+e.error);
  if(e.error==="not-allowed"||e.error==="service-not-allowed"){micErr="Micrófono/voz bloqueado por el navegador. Permítelo en el candado de la barra de direcciones.";micStop()}
  else if(e.error==="audio-capture"){micErr="No se encuentra un micrófono.";micStop()}
  else if(e.error==="network"){micErr="El servicio de voz del navegador no responde (¿sin internet?). Se reintenta solo.";setTimeout(()=>{micErr=""},8000)}};
 recOn=true;try{rec.start()}catch(x){}}
function micStop(){recOn=false;try{rec&&rec.stop()}catch(x){}rec=null;interim=""}
function addSeg(x){if(!x||!G)return;const w=G.role==="ator"?"ator":"medico";const seg={id:w+(++segN)+"_"+Date.now(),w,t:Math.max(0,G.A.dur-remain()),x};TR.push(seg);if(TR.length>800)TR.shift();send({t:"T",v:seg});if(view==="sala"&&(tab==="tr"||(w==="medico"&&helpLive())))render()}
function trLines(){return TR.length?TR.map(x=>`<div class="item small"><span class="mut">[${mmss(x.t)}]</span> <b>${x.w==="ator"?"ACTOR":"MÉDICO"}:</b> ${esc(x.x)}</div>`).join(""):"<span class='mut'>Aún no hay transcripción.</span>"}
function trCard(){return `<div class="card"><h3 style="margin-top:0">Transcripción en vivo</h3><div class="small mut" style="margin-bottom:8px">Cada navegador transcribe su propio micrófono y lo comparte. Usen audífonos para que el micrófono no capte la voz de la otra persona.</div>${trLines()}<div class="small mut interim">${esc(interim)}</div></div>`}

/* ---------- buscador y resaltado local ---------- */
const HLP={q:"",only:false,from:0};
const STOP=new Set(("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem e ou que se te me lhe voce senhor senhora doutor doutora tem tenho tinha ha esta estou estao foi ser sao ao aos mais muito mas como quando onde qual quais desde ate isso isto esse essa este esta eu ele ela nao sim la ai aqui vou vamos pode posso gostaria queria fazer faz fez sente sentiu sinto sentindo sentir notou teve tinha tive tenho algum alguma algo diga conte conta me fale falar "+
 "el la los las un una unos unas y en con sin por para que se te me le usted senor tiene tengo tenia hay estoy fue son al mas muy pero como cuando donde cual desde hasta eso esto ese esa yo no si quiero puedo voy vamos hacer hace").split(" "));
const STOPIMP=new Set("exame exames resultado resultados completo completa geral dosagem teste sumario pedido solicito solicitar".split(" "));
const toks=t=>nrm(t).replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>=3&&!STOP.has(w));
const stemW=w=>{if(w.length>=5)w=w.replace(/(es|s)$/,"");return w.slice(0,4)};
const _ss=new Map();
function stems(t,imp){const k=(imp?"i":"n")+t;let r=_ss.get(k);if(!r){r=new Set(toks(t).filter(w=>!(imp&&STOPIMP.has(w))).map(stemW));if(_ss.size>3000)_ss.clear();_ss.set(k,r)}return r}
const AC={a:"[aàáâãä]",e:"[eèéêë]",i:"[iìíîï]",o:"[oòóôõö]",u:"[uùúûü]",c:"[cç]",n:"[nñ]"};
function qWords(){return nrm(HLP.q).split(/\s+/).map(w=>w.replace(/[^a-z0-9]/g,"")).filter(w=>w.length>=2)}
function hlRe(){const w=qWords();if(!w.length)return null;try{return new RegExp(w.map(x=>x.split("").map(c=>AC[c]||c).join("")).join("|"),"gi")}catch(e){return null}}
function hlText(t,re){t=String(t==null?"":t);if(!re)return esc(t);let out="",last=0,m;re.lastIndex=0;while((m=re.exec(t))){if(!m[0]){re.lastIndex++;continue}out+=esc(t.slice(last,m.index))+"<mark>"+esc(m[0])+"</mark>";last=m.index+m[0].length}return out+esc(t.slice(last))}
const isAtor=()=>!!G&&G.role==="ator"&&G.A.phase!=="done";
/* hq: texto con las palabras buscadas marcadas (solo el actor) */
function hq(t){return isAtor()&&HLP.q.trim()?hlText(t,hlRe()):esc(t)}
function qMatch(t){const w=qWords();if(!w.length)return false;const n=nrm(t);return w.every(x=>n.includes(x))}
function helpLive(){return !!G&&G.role==="ator"&&view==="sala"&&tab==="main"&&G.A.phase!=="done"}

/* lo último que dijo el médico (hasta 3 frases desde el último "limpiar") */
function liveInfo(){const med=TR.slice(HLP.from).filter(x=>x.w==="medico").slice(-3);if(!med.length)return{txt:"",st:new Set()};
 const st=new Set();med.forEach(x=>stems(x.x).forEach(v=>st.add(v)));return{txt:med[med.length-1].x,st}}
function scoreSet(t,st,imp){if(!st.size)return 0;let n=0;stems(t,imp).forEach(v=>{if(st.has(v))n++});return n}
function corpus(s){if(s._cp)return s._cp;const L=[];const sp=t=>String(t||"").split(/\n+/).map(x=>x.trim()).filter(x=>x.length>=12);
 s.ator.forEach(x=>L.push({src:"Paciente · "+GRP.find(a=>a[0]===grpOf(x))[1].split(" y ")[0],txt:x,live:1}));
 sp(s.descricao).forEach(x=>L.push({src:"Descripción",txt:x,live:s.ator.length?0:1}));
 sp(s.sinteseTexto).forEach(x=>L.push({src:"Síntesis INEP",txt:x,live:s.ator.length?0:1}));
 s.itens.forEach(it=>L.push({src:"PEP "+it.n,txt:it.t+(it.a?" · A: "+it.a:"")+(it.p?" · P: "+it.p:"")}));
 s.impressos.forEach((im,i)=>{L.push({src:"Impreso",txt:im.titulo,imp:i});sp(im.texto).slice(0,60).forEach(x=>L.push({src:"Impreso · "+im.titulo.slice(0,30),txt:x}))});
 s._cp=L;return L}
function searchAll(s){return corpus(s).filter(r=>qMatch(r.txt))}
function liveSuggest(s,li){const a=corpus(s).filter(r=>r.live).map((r,i)=>({r,i,sc:scoreSet(r.txt,li.st)})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc||a.i-b.i);const m=a.length?a[0].sc:0;return a.filter(x=>x.sc>=m).map(x=>x.r)}
function liveScore(txt){const li=liveInfo();return scoreSet(txt,li.st)}
/* ¿el médico mencionó este ítem del PEP durante la sesión? (pista, no calificación) */
function pepMent(i){if(!isAtor())return false;const s=byId(G.sid),it=s&&s.itens[i];if(!it||!TR.length)return false;
 const key=TR.length+"|"+G.sid;if(pepMent.k!==key){pepMent.k=key;const st=new Set();TR.filter(x=>x.w==="medico").forEach(x=>stems(x.x).forEach(v=>st.add(v)));pepMent.st=st}
 return scoreSet(it.t,pepMent.st)>=2}
/* ¿el médico pidió este impreso? (parpadea el botón) */
function impAsked(im){if(!isAtor())return false;const li=liveInfo();if(!li.st.size)return false;const t=stems(im.titulo,true);if(!t.size)return false;let n=0;t.forEach(v=>{if(li.st.has(v))n++});return n>=1}

function hlSet(v){HLP.q=String(v||"").slice(0,80);clearTimeout(hlSet.t);hlSet.t=setTimeout(render,180)}
function hlClear(){HLP.q="";HLP.from=TR.length;render()}
function helpBar(s){if(!isAtor())return"";const q=HLP.q.trim(),li=liveInfo(),re=q?hlRe():null;let body="";
 const relBtn=r=>r.imp!=null?` <button class="g" onclick="rel(${r.imp})">${G.A.rel.imp.includes(r.imp)?"✔ liberado (quitar)":"Liberar al médico"}</button>`:"";
 if(q){const res=searchAll(s).slice(0,14);body=res.length?res.map(r=>`<div class="hr"><span class="tag">${esc(r.src)}</span> ${hlText(r.txt,re)}${relBtn(r)}</div>`).join(""):'<div class="mut small">Sin coincidencias.</div>'}
 else if(li.txt){const sg=liveSuggest(s,li).slice(0,3);body=sg.length?sg.map(r=>`<div class="hr live">${esc(r.txt)}</div>`).join(""):'<div class="mut small">—</div>'}
 else body=`<div class="mut small">${cfg.mic?"Respuestas del actor":"Voz apagada · usa el buscador"}</div>`;
 return `<div class="card helpbar"><div class="row"><input id="hq" class="grow" placeholder="🔎 Buscar…" value="${esc(HLP.q)}" oninput="hlSet(this.value)" autocomplete="off" style="max-width:320px"><button class="g" onclick="hlClear()" title="Limpiar">✕</button></div>
 <div class="hres" data-keep id="hres">${body}</div></div>`}

/* ---------- guion del paciente (con resaltado) ---------- */
/* El INEP publica el guion como lista de hechos. Aquí se ordena por TEMA (clasificación automática por palabras clave, no oficial)
   y cada hecho se presenta como "si pregunta por X → responde". */
const GRP=[
 ["mot","Motivo de consulta y preocupación","¿Qué lo trae? ¿Qué le preocupa?",/compareceu|procurou|veio |vem |motivo|trouxe|trazida|encaminhad|preocupad|medo|receio|teme|ansios|queixa|expectativa/],
 ["soc","Datos personales y contexto social","¿Nombre, edad, estado civil, trabajo, con quién vive?",/seu nome|nome e |^tem \d+ (anos|meses)|casad|solteir|viuv|divorci|profiss|trabalha|mora |reside|moradia|escolaridade|companheir|marido|esposo|renda|saneamento/],
 ["sin","Síntomas e historia actual","Dolor, tiempo de evolución, características, síntomas asociados",null],
 ["neg","Lo que NO tiene (negativos)","¿Tiene fiebre? ¿vómitos? ¿otro síntoma? → NO",/^(nao|nunca|nega|sem)\b/],
 ["ant","Antecedentes personales","Enfermedades previas, cirugías, internaciones, embarazos, vacunas",/nunca teve|ja teve|historic|antecedente|cirurgia|internac|diabet|hipertens|asma|doenca|vacina|gesta|gravid|parto|menstru|menarca|\bdum\b|pre-natal|pre natal|cesarea|aborto|infecc|transfus|saudavel|comorbid/],
 ["med","Medicamentos y alergias","¿Toma algún remedio? ¿Alergias?",/alergi|medicament|medicac|remedio|uso de|anticoncepc|\btoma\b|tomando|insulina|em uso/],
 ["hab","Hábitos de vida","Tabaco, alcohol, drogas, alimentación, actividad física, sueño, agua, orina…",/fuma|tabag|cigarro|alcool|bebe|bebida|drog|dieta|alimenta|exerci|atividade fisica|sedentar|\bsono\b|\bagua\b|hidrata|habito|sexual|preservativo|parceir/],
 ["fam","Antecedentes familiares","¿Alguien en la familia con…?",/\bpai\b|\bmae\b|irmao|irma\b|\bavo\b|\bavos\b|\btio\b|\btia\b|familiar|familia/]];
const GORD=["mot","soc","sin","neg","ant","med","hab","fam"],GCLS=["med","hab","mot","fam","ant","soc","neg"];
function grpOf(x){const n=nrm(x);if(/^(seu nome|se chama|sua idade|tem \d+ anos)/.test(n))return"soc";for(const k of GCLS){const g=GRP.find(a=>a[0]===k);if(g[3]&&g[3].test(n))return k}return"sin"}
function cueOf(x){let t=String(x).replace(/\s+/g," ").trim().replace(/[;.]+$/,"");
 t=t.replace(/^(seu nome é|sua idade é)\s*/i,"").replace(/^(n[aã]o|nunca)\s+(teve|tem|tinha|há|houve|apresentou|notou|sente|sentiu|refere|fez|faz|usa|toma|fuma|bebe|possui|est[aá] com|est[aá])\s+/i,"").replace(/^(sente|sentiu|est[aá] com|est[aá]|notou( que)?|tem|teve|tinha|refere|apresenta|apresentou|fez|faz|usa|toma|fuma|bebe|possui|compareceu|procurou|veio|nega|marcou)\s+(o |a |um |uma |os |as |de |do |da |ao |à )?/i,"");
 t=t.split(/\s+(há|desde|faz|durante)\s|\s[—–]\s|,/)[0];return t.length>70?t.slice(0,68)+"…":t}
const isNeg=x=>/^(n[aã]o|nunca|nega|sem)\b/i.test(String(x).trim())||/\bn[aã]o (tem|teve|possui)\b/i.test(String(x));
function grpData(s){if(s._gp)return s._gp;const o={};GORD.forEach(k=>o[k]=[]);s.ator.forEach((x,i)=>{const k=grpOf(x);let c=cueOf(x);const n=nrm(x);
  if(k==="soc")c="nombre, edad, estado civil, trabajo";else if(k==="mot"&&/compareceu|procurou|veio|vem |trouxe|leva |encaminhad/.test(n))c="motivo de consulta";else if(k==="mot"&&/preocup|medo|receio|teme/.test(n))c="qué le preocupa";
  o[k].push({x,i,cue:c,neg:isNeg(x)})});s._gp=o;return o}
function gjump(k){const e=document.getElementById("gs-"+k);if(e)e.scrollIntoView({behavior:"smooth",block:"start"})}
function pacHtml(s){const re=isAtor()&&HLP.q.trim()?hlRe():null,live=isAtor()?liveInfo():{st:new Set()};
 const total=s.ator.length,gd=grpData(s);let secs="",nav="";
 const mx=Math.max(0,...s.ator.map(x=>scoreSet(x,live.st)));/* solo se pinta lo que mejor coincide con lo que dijo el médico */
 const TIT={mot:"Motivo de consulta",soc:"Datos personales",sin:"Síntomas",neg:"No tiene",ant:"Antecedentes personales",med:"Medicamentos y alergias",hab:"Hábitos",fam:"Antecedentes familiares"};
 const row=l=>`<div class="gr ${l.lv>0?"live":""}"><div class="ga">${re?hlText(l.x,re):esc(l.x)}</div></div>`;
 GORD.forEach(k=>{if(k==="neg")return;let src=k==="sin"?gd.sin.concat(gd.neg):gd[k];let L=src.map(l=>({...l,lv:mx>0&&scoreSet(l.x,live.st)===mx?1:0}));if(re&&HLP.only)L=L.filter(l=>qMatch(l.x));if(!L.length)return;
  nav+=`<button class="g" onclick="gjump('${k}')">${TIT[k]}</button>`;
  const sub=t=>`<div class="gh">${t}</div>`;
  const rows=k==="sin"?sub("Síntoma principal")+row(L[0])+(L.length>1?sub("Otros síntomas")+L.slice(1).map(row).join(""):""):sub(TIT[k])+L.map(row).join("");
  secs+=`<div class="gsec" id="gs-${k}">${rows}</div>`});
 return `<div class="card"><h3 style="margin-top:0">Respuestas del paciente</h3>${total?`
 <div class="row" style="gap:4px;margin-bottom:6px">${nav}</div>${secs||"<div class='mut'>Sin coincidencias.</div>"}`:
  `<div class="warn">El INEP no publicó el guion del paciente para esta estación (${esc(ed(s.edicao))}). ${s.sinteseTexto?"Abajo tienes la síntesis completa del INEP; el buscador también la recorre.":"En las ediciones hasta 2022.2 solo publicó instrucciones, impresos y PEP."} Puedes probar otra estación.</div><button class="b" onclick="otraConGuion()">🔀 Otra estación con guion oficial</button>`}</div>
 ${s.sinteseTexto?`<details class="card" ${re&&qMatch(s.sinteseTexto)?"open":""}><summary style="cursor:pointer"><b>Síntesis completa del INEP</b> (orientaciones al avaliador)</summary><pre style="margin-top:8px">${re?hlText(s.sinteseTexto,re):esc(s.sinteseTexto)}</pre></details>`:""}`}
