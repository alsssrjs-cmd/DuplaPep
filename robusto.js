/* Robustez: registro, errores visibles, diagnóstico, pantalla encendida, aviso al cerrar. Se carga antes que todo. */
const VERSION="1.3 · 2026-11-09";
const LOG=[];
function dbg(m){try{LOG.push(new Date().toLocaleTimeString()+"  "+String(m).slice(0,300));if(LOG.length>60)LOG.shift()}catch(e){}}
function showErr(msg){try{let b=document.getElementById("errbar");if(!b){b=document.createElement("div");b.id="errbar";b.setAttribute("role","alert");document.body.appendChild(b)}
 b.innerHTML="";const t=document.createElement("span");t.textContent="⚠ "+String(msg).slice(0,200)+" ";const v=document.createElement("button");v.textContent="Ver diagnóstico";v.onclick=()=>{try{go("diag")}catch(e){}};const c=document.createElement("button");c.textContent="Cerrar";c.onclick=()=>b.remove();b.append(t,v,c)}catch(e){}}
window.addEventListener("error",e=>{
 if(e.target&&e.target.tagName==="IMG"){if(e.target.dataset.fail)return;e.target.dataset.fail="1";const s=document.createElement("span");s.className="mut small";s.textContent="(imagen no disponible)";e.target.replaceWith(s);dbg("imagen no cargó: "+(e.target.getAttribute&&e.target.getAttribute("src")));return}
 dbg("error: "+e.message+" @"+String(e.filename||"").split("/").pop()+":"+e.lineno);showErr("Algo falló: "+e.message)},true);
window.addEventListener("unhandledrejection",e=>{const m=(e.reason&&e.reason.message)||String(e.reason);dbg("promesa rechazada: "+m);showErr("Algo falló: "+m)});
let wl=null;
async function wlRequest(){try{if(navigator.wakeLock&&!wl){wl=await navigator.wakeLock.request("screen");wl.addEventListener("release",()=>{wl=null})}}catch(e){dbg("wakeLock: "+e.message)}}
function wlRelease(){try{wl&&wl.release()}catch(e){}wl=null}
document.addEventListener("visibilitychange",()=>{try{if(document.visibilityState==="visible"&&G&&G.A&&G.A.phase==="run")wlRequest()}catch(e){}});
window.addEventListener("beforeunload",e=>{try{if(G&&G.A&&(G.A.phase==="run"||G.A.phase==="paused")){e.preventDefault();e.returnValue=""}}catch(x){}});

/* ---------- diagnóstico ---------- */
function diagRow(id,label){return `<div class="item row"><span class="grow">${esc(label)}</span><span id="${id}" class="small">…</span></div>`}
function setD(id,ok,txt){const e=document.getElementById(id);if(e){e.textContent=(ok===null?"➖ ":ok?"✅ ":"❌ ")+txt}}
function diagPage(){
 const checks=[["d1","Contexto seguro (https/localhost)"],["d2","Cifrado del código de sala (crypto.subtle)"],["d3","Videollamada (WebRTC)"],["d4","Cámara y micrófono"],["d5","Reconocimiento de voz (Chrome/Edge)"],["d6","Guardado local (localStorage)"],["d7","Servidor de encuentro (PeerJS)"],["d8","Pantalla siempre encendida"],["d10","Banco de estaciones cargado"]];
 $("#app").innerHTML=`<div class="card"><h3 style="margin-top:0">🩺 Diagnóstico</h3><div class="small mut">Versión ${esc(VERSION)} · ${esc(location.protocol+"//"+location.host)}</div>${checks.map(([i,l])=>diagRow(i,l)).join("")}
 <div class="row" style="margin-top:12px"><button class="g" onclick="diagCopy()">Copiar registro</button><button class="g" onclick="diagWipe()">Borrar datos locales</button></div></div>
 <div class="card"><h3 style="margin-top:0">Registro reciente</h3><pre class="small" id="dlog">${esc(LOG.join("\n")||"(vacío)")}</pre></div>`;
 setD("d1",window.isSecureContext,window.isSecureContext?"sí":"no: abre la app desde https o localhost");
 setD("d2",!!(window.crypto&&crypto.subtle),(window.crypto&&crypto.subtle)?"disponible":"no disponible (código menos protegido)");
 setD("d3",!!window.RTCPeerConnection,window.RTCPeerConnection?"disponible":"este navegador no soporta WebRTC");
 setD("d5",!!(window.SpeechRecognition||window.webkitSpeechRecognition),(window.SpeechRecognition||window.webkitSpeechRecognition)?"disponible":"no disponible: no habrá transcripción (el buscador sí funciona)");
 setD("d8",!!navigator.wakeLock,navigator.wakeLock?"disponible":"no disponible (la pantalla puede apagarse)");
 try{localStorage.setItem("rvp2_t","1");localStorage.removeItem("rvp2_t");setD("d6",true,"funciona")}catch(e){setD("d6",false,"bloqueado: no se guardará el historial")}
 (async()=>{try{if(navigator.permissions){const c=await navigator.permissions.query({name:"camera"}),m=await navigator.permissions.query({name:"microphone"});setD("d4",c.state!=="denied"&&m.state!=="denied",`cámara ${c.state}, micrófono ${m.state}`)}else setD("d4",null,"no se puede consultar")}catch(e){setD("d4",null,"no se puede consultar")}})();
 (async()=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),6000);try{await fetch("https://0.peerjs.com/",{mode:"no-cors",signal:ac.signal});setD("d7",true,"responde")}catch(e){setD("d7",false,"no responde (sin internet o bloqueado): no podrán crear sala")}finally{clearTimeout(t)}})();
 try{const n=(window.ESTACOES||[]).length;setD("d10",n>0,n>0?n+" estaciones":"0: data.js no cargó; recarga sin caché (Ctrl+F5)")}catch(e){}
 }
function diagCopy(){const t="Versión "+VERSION+"\n"+navigator.userAgent+"\n"+LOG.join("\n");try{navigator.clipboard.writeText(t);alert("Registro copiado.")}catch(e){prompt("Copia el registro:",t)}}
function diagWipe(){if(!confirm("¿Borrar historial, ajustes y llaves guardadas en este navegador? No se puede deshacer."))return;try{Object.keys(localStorage).filter(k=>k.startsWith("rvp2")).forEach(k=>localStorage.removeItem(k));Object.keys(sessionStorage).filter(k=>k.startsWith("rvp2")).forEach(k=>sessionStorage.removeItem(k))}catch(e){}location.reload()}

/* tamaño de letra de las columnas (A- / A+), se recuerda */
let FS=18;try{const x=+localStorage.getItem("rvp2_fs");if(x>=14&&x<=30)FS=x}catch(e){}
function setFs(d){FS=Math.max(14,Math.min(30,FS+d*2));try{localStorage.setItem("rvp2_fs",String(FS))}catch(e){}try{render()}catch(e){}}
/* panel de video: se arrastra desde cualquier parte, esquina para tamaño, doble clic = esquina inferior derecha, recuerda posición (rvp2_vid) */
(function(){const v=document.getElementById("vid");if(!v)return;const K="rvp2_vid",MIN=150,MAX=480;let mode=null,ox=0,oy=0,sw=0,sx=0;
 v.style.touchAction="none";v.style.cursor="move";
 const h=document.createElement("div");h.title="Cambiar tamaño";h.style.cssText="position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;z-index:3;background:linear-gradient(135deg,transparent 50%,#fffa 50%);touch-action:none";v.appendChild(h);
 function clamp(){if(!v.style.left)return;if(v.offsetWidth>innerWidth-8)v.style.width=Math.max(100,innerWidth-8)+"px";const r=v.getBoundingClientRect();v.style.left=Math.max(0,Math.min(innerWidth-r.width,r.left))+"px";v.style.top=Math.max(0,Math.min(innerHeight-r.height,r.top))+"px"}
 function save(){try{const r=v.getBoundingClientRect();localStorage.setItem(K,JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width)}))}catch(e){}}
 function reset(){v.style.left=v.style.top="";v.style.right="12px";v.style.bottom="12px";v.style.width="190px";try{localStorage.removeItem(K)}catch(e){}}
 try{const s=JSON.parse(localStorage.getItem(K)||"null");if(s&&isFinite(s.l)&&isFinite(s.t)&&isFinite(s.w)){v.style.width=Math.max(MIN,Math.min(MAX,s.w))+"px";v.style.left=s.l+"px";v.style.top=s.t+"px";v.style.right="auto";v.style.bottom="auto";clamp()}}catch(e){}
 v.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;const r=v.getBoundingClientRect();mode=e.target===h?"size":"move";ox=e.clientX-r.left;oy=e.clientY-r.top;sw=r.width;sx=e.clientX;v.setPointerCapture(e.pointerId);e.preventDefault()});
 v.addEventListener("pointermove",e=>{if(!mode)return;if(mode==="move"){const r=v.getBoundingClientRect();v.style.left=Math.max(0,Math.min(innerWidth-r.width,e.clientX-ox))+"px";v.style.top=Math.max(0,Math.min(innerHeight-r.height,e.clientY-oy))+"px";v.style.right="auto";v.style.bottom="auto"}else{const r=v.getBoundingClientRect();v.style.left=r.left+"px";v.style.top=r.top+"px";v.style.right="auto";v.style.bottom="auto";v.style.width=Math.max(MIN,Math.min(MAX,innerWidth-r.left,sw+e.clientX-sx))+"px"}});
 const end=()=>{if(mode){mode=null;clamp();save()}};v.addEventListener("pointerup",end);v.addEventListener("pointercancel",end);
 v.addEventListener("dblclick",e=>{if(!e.target.closest("button"))reset()});
 addEventListener("resize",()=>{clamp();})})();

/* visor de imágenes: clic en una imagen de impreso/resultado = verla completa; − + ajustan, ✕ / Esc / clic fuera cierran */
(function(){let box=null,im=null,z=1;
 function ap(){if(im)im.style.maxWidth=im.style.maxHeight=z===1?"100%":"none";if(im)im.style.width=z===1?"auto":(z*100)+"%"}
 function close(){if(box){box.remove();box=null;im=null}}
 function open(src,alt){close();z=1;box=document.createElement("div");box.id="rvlb";box.style.cssText="position:fixed;inset:0;z-index:99;background:#000d;display:flex;flex-direction:column";
  const bar=document.createElement("div");bar.style.cssText="display:flex;gap:8px;justify-content:center;align-items:center;padding:8px;color:#fff;flex:none";
  const mk=(t,f,ti)=>{const b=document.createElement("button");b.textContent=t;b.title=ti;b.style.cssText="font-size:20px;min-width:48px;padding:6px 12px;border:0;border-radius:8px;background:#fff;color:#000;cursor:pointer";b.onclick=e=>{e.stopPropagation();f()};return b};
  bar.append(mk("−",()=>{z=Math.max(1,+(z-.5).toFixed(1));ap()},"Disminuir"),mk("+",()=>{z=Math.min(5,+(z+.5).toFixed(1));ap()},"Aumentar"),mk("✕ Cerrar",close,"Cerrar"));
  const sc=document.createElement("div");sc.style.cssText="flex:1;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:8px";
  im=document.createElement("img");im.src=src;im.alt=alt||"";im.style.cssText="max-width:100%;max-height:100%;background:#fff;border-radius:6px";
  sc.appendChild(im);box.append(bar,sc);box.addEventListener("click",e=>{if(e.target===box||e.target===sc)close()});document.body.appendChild(box)}
 document.addEventListener("click",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&!t.closest("#vid")&&!t.closest("#rvlb")&&t.getAttribute("src")){open(t.src,t.alt)}});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
 document.addEventListener("mouseover",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&!t.closest("#vid")&&!t.closest("#rvlb")){t.style.cursor="zoom-in"}})})();
/* tema blanco/negro: botón en la cabecera, recuerda la elección (rvp2_theme) */
(function(){const b=document.getElementById("thm");if(!b)return;const R=document.documentElement;
 const cur=()=>R.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
 const show=()=>{b.textContent=cur()==="dark"?"☀️":"🌙";b.title=cur()==="dark"?"Cambiar a fondo blanco":"Cambiar a fondo negro"};
 b.addEventListener("click",()=>{const n=cur()==="dark"?"light":"dark";R.setAttribute("data-theme",n);try{localStorage.setItem("rvp2_theme",n)}catch(e){}show()});show()})();