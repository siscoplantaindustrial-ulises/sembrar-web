const {chromium}=require('playwright-core');const serve=require('./serve');const {spawn}=require('child_process');const fs=require('fs');
const EXE=process.env.LOCALAPPDATA+'/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const FF=require('ffmpeg-static');const FPS=30;
(async()=>{
  const stills=process.argv.slice(2).map(Number);
  const s=await serve(8124);const b=await chromium.launch({executablePath:EXE});
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1.5});
  await p.goto('http://localhost:8124/_video.html');await p.evaluate(()=>init());
  fs.writeFileSync('timeline.json',JSON.stringify(await p.evaluate(()=>TIMELINE)));
  if(stills.length){fs.mkdirSync('stills',{recursive:true});
    for(const t of stills){await p.evaluate(t=>renderAt(t),t);await p.screenshot({path:`stills/t${t.toFixed(2)}.png`})}
  } else {
    const N=Math.round(22*FPS);
    const ff=spawn(FF,['-y','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium','video.mp4'],{stdio:['pipe','ignore','inherit']});
    for(let i=0;i<N;i++){await p.evaluate(t=>renderAt(t),i/FPS);const buf=await p.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%60==0)console.log('frame',i)}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));
  }
  await b.close();s.close();
})();
