const {chromium}=require('playwright-core');const serve=require('./serve');
const EXE=process.env.LOCALAPPDATA+'/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
(async()=>{const s=await serve(8123);const b=await chromium.launch({executablePath:EXE});const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:8123/');await p.evaluate(()=>document.fonts.ready);
const r=await p.evaluate(()=>{const o={H:document.documentElement.scrollHeight};for(const id of['inicio','producto','cotizador','contacto'])o[id]=document.getElementById(id).getBoundingClientRect().top+scrollY;o.cards=[...document.querySelectorAll('#pedido .card')].map(c=>{const b=c.getBoundingClientRect();return [Math.round(b.top+scrollY),Math.round(b.height),Math.round(b.left),Math.round(b.width)]});const a=document.querySelector('#pedido aside').getBoundingClientRect();o.aside=[a.top+scrollY,a.height,a.left,a.width];o.tipos=document.querySelector('h3').getBoundingClientRect().top+scrollY;return o});
console.log(JSON.stringify(r));
for(const y of[0,r.tipos-80,r.cotizador])await p.evaluate(y=>scrollTo(0,y),y),await p.screenshot({path:`probe-${Math.round(y)}.png`});
await b.close();s.close()})();
