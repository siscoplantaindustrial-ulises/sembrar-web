const {chromium}=require('playwright-core');const serve=require('./serve');
(async()=>{const s=await serve(8127);const b=await chromium.launch({executablePath:process.env.LOCALAPPDATA+'/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
for(const f of ['index.old.html','index.html']){const p=await b.newPage({viewport:{width:400,height:711}});await p.goto('http://localhost:8127/'+f);await p.evaluate(()=>document.fonts.ready);
console.log(f,JSON.stringify(await p.evaluate(()=>['header','#producto','#cotizador','select[name=maquina]','[data-group=hileras]','input[name=m1]','#enviar','body'].map(s=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();return [s,Math.round(r.top+scrollY),Math.round(r.height)]}))));
await p.screenshot({path:'nav-'+f+'.png',clip:{x:0,y:0,width:400,height:120}});}
await b.close();s.close()})();
