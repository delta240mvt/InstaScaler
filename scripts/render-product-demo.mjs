import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const raw=resolve('landing/.recording'), out=resolve('landing/public/media');
mkdirSync(out,{recursive:true});
function run(command,args) {
  const r=spawnSync(command,args,{stdio:['ignore','pipe','pipe'],encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error(`${command}: ${r.stderr}`);
  return r.stdout;
}
function probe(file) { return JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file])); }
const scenes=['campaign','path','preview','contacts'];
let total=0;
const chapters=[];
for(const scene of scenes) {
  const source=resolve(raw,`${scene}.webm`), meta=JSON.parse(readFileSync(resolve(raw,`${scene}.json`),'utf8'));
  const duration=Number(probe(source).format.duration);
  // The capture starts before navigation. Keep just the ready-screen interaction at its end.
  const start=Math.max(0,duration-meta.duration-0.2);
  const cut=Math.min(meta.duration,duration-start);
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',start.toFixed(3),'-i',source,'-t',cut.toFixed(3),'-an','-vf','fps=30,scale=1440:960:flags=lanczos,setsar=1','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p',resolve(raw,`${scene}-cut.mp4`)]);
  const encodedDuration=Number(probe(resolve(raw,`${scene}-cut.mp4`)).format.duration);
  chapters.push({scene,start:total,end:total+encodedDuration});total+=encodedDuration;
}
const concat=resolve(raw,'concat.txt');
writeFileSync(concat,scenes.map(scene=>`file '${scene}-cut.mp4'`).join('\n'));
const mp4=resolve(out,'instascaler-demo.mp4');
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-an','-c','copy','-movflags','+faststart',mp4]);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mp4,'-an','-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1','-deadline','good','-cpu-used','3',resolve(out,'instascaler-demo.webm')]);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','2','-i',mp4,'-frames:v','1','-c:v','libwebp','-quality','88',resolve(out,'instascaler-poster.webp')]);
const names={campaign:'Konfiguracja kampanii: wybór słowa kluczowego i przygotowanie wiadomości.',path:'Edytor ścieżki: połączenie pytań i kolejnych kroków.',preview:'Podgląd rozmowy: test wyboru odpowiedzi i adresu e-mail bez wysyłania DM.',contacts:'Baza kontaktów: filtrowanie przykładowych kontaktów według kwalifikacji i e-maila.'};
const time=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(resolve(out,'instascaler-pl.vtt'),'WEBVTT\n\n'+chapters.map(c=>`${time(c.start)} --> ${time(c.end)}\n${names[c.scene]}\nDane demonstracyjne.\n`).join('\n'));
const files=Object.fromEntries(['mp4','webm'].map(ext=>{
  const data=readFileSync(resolve(out,`instascaler-demo.${ext}`));
  return[ext,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];
}));
const duration=Number(probe(mp4).format.duration);
writeFileSync('landing/src/data/product-video.json',JSON.stringify({duration,mp4:'/media/instascaler-demo.mp4',webm:'/media/instascaler-demo.webm',poster:'/media/instascaler-poster.webp',width:1440,height:960,chapters,files,provenance:'Actual local InstaScaler production build, controlled e2e fixtures, no external requests or live messages. scripts/record-product-demo.ts + scripts/render-product-demo.mjs'},null,2)+'\n');
console.log(JSON.stringify({duration,files,chapters},null,2));
