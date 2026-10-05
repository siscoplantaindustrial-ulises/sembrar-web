const http=require('http'),fs=require('fs'),path=require('path');
const T={'.html':'text/html','.png':'image/png','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'};
module.exports=(port)=>new Promise(r=>{const s=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(__dirname,'site',p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});res.end(d)})});s.listen(port,()=>r(s))});
