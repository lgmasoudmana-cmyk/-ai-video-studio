import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { v4 as uuidv4 } from "uuid";
import ffmpegPath from "ffmpeg-static";
import RunwayML from "@runwayml/sdk";

const exec=promisify(execFile);
const app=express(), port=process.env.PORT||3000;
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});
const client=new RunwayML({apiKey:process.env.RUNWAYML_API_SECRET});
const jobs=new Map();
const STORE=path.resolve("storage");
await fs.mkdir(STORE,{recursive:true});

app.use(express.json({limit:"2mb"}));
const INDEX_HTML = `<!doctype html><html lang="fa" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="#090b10"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="AI Video Studio">
<title>AI Video Studio — iPhone</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#090b10;color:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif}
main{max-width:980px;margin:auto;padding:calc(18px + env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom))}.hero{padding:22px 0}.hero h1{font-size:32px;margin:0}.muted{color:#9ca3af}.card{background:#141821;border:1px solid #2b313d;border-radius:18px;padding:18px;margin:14px 0}
.scene{border:1px solid #303744;border-radius:15px;padding:14px;margin:12px 0}.head{display:flex;justify-content:space-between;align-items:center;gap:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
input,textarea,select,button{font:inherit}input,textarea,select{width:100%;min-height:48px;background:#0c0f15;color:#fff;border:1px solid #343b49;border-radius:11px;padding:11px}textarea{min-height:110px}
button{border:0;border-radius:11px;padding:14px 16px;min-height:48px;cursor:pointer;font-weight:800}.primary{width:100%;background:#fff;color:#080a0e;margin-top:15px}.danger{background:#2a303b;color:#fff}.add{background:#252c38;color:#fff}.thumb{max-width:160px;max-height:120px;display:none;margin-top:8px;border-radius:9px}
.status{white-space:pre-wrap;background:#0c0f15;border-radius:11px;padding:12px;margin-top:12px;color:#d4d7de}video{width:100%;display:none;margin-top:14px;border-radius:13px;background:#000}
a.dl{display:none;color:#fff;background:#252c38;text-decoration:none;padding:12px;border-radius:11px;text-align:center;margin-top:10px}
@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style></head><body><main>
<div class="hero"><h1>🎬 AI Video Studio</h1><div class="muted">نسخه مخصوص Safari آیفون • ساخت چند صحنه و خروجی MP4</div><div id="health" class="muted" style="margin-top:8px">در حال بررسی اتصال...</div></div>

<section class="card"><h2>تصویر مرجع اصلی</h2>
<input id="mainImage" type="file" accept="image/png,image/jpeg,image/webp">
<img id="mainThumb" class="thumb"></section>

<section class="card"><h2>صحنه‌های فیلم</h2><div id="scenes"></div>
<button class="add" onclick="addScene()">＋ افزودن صحنه</button> <button class="danger" onclick="location.reload()">بازنشانی</button></section>

<section class="card"><h2>تنظیمات</h2>
<div class="grid"><div><label>نسبت تصویر</label><select id="ratio"><option value="1280:720">16:9</option><option value="720:1280">9:16</option><option value="960:960">1:1</option></select></div>
<div><label>مدت هر صحنه</label><select id="duration"><option value="5">5 ثانیه</option><option value="8">8 ثانیه</option><option value="10">10 ثانیه</option></select></div></div>
<button id="go" class="primary">🎥 ساخت کل فیلم</button>
<div id="status" class="status">آماده.</div><video id="video" controls playsinline></video><a id="dl" class="dl" target="_blank">باز کردن / ذخیره ویدئوی نهایی</a>
</section>
</main>
<script>
const scenes=document.getElementById("scenes"), ratio=document.getElementById("ratio"), duration=document.getElementById("duration");
let n=0;
function addScene(text=""){
 n++;const d=document.createElement("div");d.className="scene";d.dataset.n=n;
 d.innerHTML=\`<div class="head"><b>صحنه \${n}</b><button class="danger" onclick="this.closest('.scene').remove()">حذف</button></div>
 <label>پرامپت صحنه</label><textarea class="sp">\${text}</textarea>
 <label>تصویر شروع مخصوص این صحنه (اختیاری)</label><input class="si" type="file" accept="image/png,image/jpeg,image/webp"><img class="thumb">
 <label>مدت</label><select class="sd"><option value="5">5 ثانیه</option><option value="8">8 ثانیه</option><option value="10">10 ثانیه</option></select>\`;
 scenes.appendChild(d);
 d.querySelector(".sd").value=duration.value;
 d.querySelector(".si").onchange=e=>{const f=e.target.files[0],im=d.querySelector("img");if(f){im.src=URL.createObjectURL(f);im.style.display="block"}};
}
addScene(\`A photorealistic cinematic shot. Masoud enters a luxurious modern house in Tehran. Preserve the character identity from the reference image. He walks naturally toward Farinaz, warm cinematic lighting, realistic hands and motion. He says in Persian: "سلام عزیزم". No subtitles, no text, no logos.\`);
addScene(\`Farinaz looks at Masoud and naturally replies in Persian: "سلام". Masoud walks beside her and says: "خیلی دوست دارم". Photorealistic faces, stable identity, subtle camera movement, elegant Tehran interior.\`);
addScene(\`Masoud gives Farinaz a single red rose and gently hugs her. Emotional but natural performance, cinematic close-up on the rose, then a wide two-shot. Preserve identity and facial details. No subtitles or visible text.\`);

const main=document.getElementById("mainImage"), mt=document.getElementById("mainThumb");
main.onchange=()=>{if(main.files[0]){mt.src=URL.createObjectURL(main.files[0]);mt.style.display="block"}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fetch("/api/health").then(r=>r.json()).then(h=>{document.getElementById("health").textContent=h.runwayConfigured?"🟢 آماده تولید (Runway متصل است)":"🟠 کلید Runway در .env تنظیم نشده"}).catch(()=>document.getElementById("health").textContent="🔴 سرور در دسترس نیست");
document.getElementById("go").onclick=async()=>{
 const status=document.getElementById("status"),go=document.getElementById("go"),vid=document.getElementById("video"),dl=document.getElementById("dl");
 const ss=[...document.querySelectorAll(".scene")]; if(!ss.length){status.textContent="حداقل یک صحنه اضافه کنید.";return}
 go.disabled=true;vid.style.display="none";dl.style.display="none";
 const fd=new FormData(); if(main.files[0])fd.append("main_image",main.files[0]);
 const data=ss.map((s,i)=>({prompt:s.querySelector(".sp").value,duration:Number(s.querySelector(".sd").value),ratio:ratio.value}));
 fd.append("scenes",JSON.stringify(data));
 ss.forEach((s,i)=>{const f=s.querySelector(".si").files[0];if(f)fd.append(\`scene_\${i}_image\`,f)});
 try{
  status.textContent="در حال شروع پروژه...";
  const r=await fetch("/api/project",{method:"POST",body:fd}),d=await r.json();if(!r.ok)throw Error(d.error||"خطا");
  for(let i=0;i<240;i++){
   await sleep(5000);const q=await fetch("/api/project/"+d.jobId),j=await q.json();if(!q.ok)throw Error(j.error||"خطا");
   status.textContent=\`وضعیت: \${j.status}\\nصحنه: \${j.done||0} از \${j.total||ss.length}\`+(j.current?\`\\nدر حال ساخت صحنه \${j.current}\`:"");
   if(j.status==="SUCCEEDED"){vid.src=j.output;vid.style.display="block";dl.href=j.output;dl.style.display="block";status.textContent+="\\n✅ فیلم نهایی آماده شد.";break}
   if(j.status==="FAILED")throw Error(j.error||"تولید ناموفق بود");
  }
 }catch(e){status.textContent="❌ "+e.message}finally{go.disabled=false}
};
</script></body></html>`;
app.get("/", (req,res)=>res.type("html").send(INDEX_HTML));

const dataUri=f=>`data:${f.mimetype||"image/jpeg"};base64,${f.buffer.toString("base64")}`;

async function download(url,out){
  const r=await fetch(url);
  if(!r.ok) throw new Error(`Download failed: ${r.status}`);
  const b=Buffer.from(await r.arrayBuffer());
  await fs.writeFile(out,b);
}

async function concatVideos(files,out){
  const list=path.join(path.dirname(out),`list-${uuidv4()}.txt`);
  await fs.writeFile(list,files.map(f=>`file '${path.resolve(f).replaceAll("'","'\\''")}'`).join("\n"));
  try{
    await exec(ffmpegPath,["-y","-f","concat","-safe","0","-i",list,"-c","copy",out]);
  }catch{
    await exec(ffmpegPath,["-y","-f","concat","-safe","0","-i",list,"-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p","-c:a","aac",out]);
  }finally{await fs.rm(list,{force:true});}
}

app.post("/api/project",upload.any(),async(req,res)=>{
  try{
    if(!process.env.RUNWAYML_API_SECRET||process.env.RUNWAYML_API_SECRET==="YOUR_RUNWAY_API_KEY")
      return res.status(500).json({error:"RUNWAYML_API_SECRET در .env تنظیم نشده است."});
    const scenes=JSON.parse(req.body.scenes||"[]");
    if(!Array.isArray(scenes)||!scenes.length) return res.status(400).json({error:"حداقل یک صحنه لازم است."});
    const files=req.files||[];
    const images={};
    for(const f of files) images[f.fieldname]=f;
    const jobId=uuidv4(), dir=path.join(STORE,jobId);
    await fs.mkdir(dir,{recursive:true});
    jobs.set(jobId,{status:"QUEUED",total:scenes.length,done:0,output:null,error:null});

    // Start in background so the browser can poll.
    (async()=>{
      const urls=[];
      try{
        for(let i=0;i<scenes.length;i++){
          jobs.set(jobId,{...jobs.get(jobId),status:"GENERATING",current:i+1});
          const s=scenes[i];
          const img=images[`scene_${i}_image`]||images.main_image;
          const task=await client.imageToVideo.create({
            model:"gen4.5",
            promptImage:img?dataUri(img):undefined,
            promptText:String(s.prompt||""),
            ratio:String(s.ratio||"1280:720"),
            duration:Number(s.duration||5)
          }).waitForTaskOutput();
          const url=task.output?.[0];
          if(!url) throw new Error(`Scene ${i+1}: no output URL`);
          const file=path.join(dir,`scene-${String(i+1).padStart(2,"0")}.mp4`);
          await download(url,file);
          urls.push(file);
          jobs.set(jobId,{...jobs.get(jobId),done:i+1,status:"GENERATING"});
        }
        const final=path.join(dir,"final.mp4");
        await concatVideos(urls,final);
        jobs.set(jobId,{...jobs.get(jobId),status:"SUCCEEDED",done:scenes.length,output:`/api/projects/${jobId}/video`});
      }catch(e){
        jobs.set(jobId,{...jobs.get(jobId),status:"FAILED",error:e?.message||String(e)});
      }
    })();

    res.json({jobId});
  }catch(e){res.status(500).json({error:e?.message||String(e)});}
});

app.get("/api/health",(req,res)=>res.json({ok:true,runwayConfigured:Boolean(process.env.RUNWAYML_API_SECRET),ffmpegConfigured:Boolean(ffmpegPath)}));

app.get("/api/project/:id",async(req,res)=>{
  const j=jobs.get(req.params.id);
  if(!j) return res.status(404).json({error:"Project not found in current server session."});
  res.json(j);
});

app.get("/api/projects/:id/video",async(req,res)=>{
  const f=path.join(STORE,req.params.id,"final.mp4");
  try{await fs.access(f);res.type("video/mp4");res.sendFile(path.resolve(f));}
  catch{res.status(404).json({error:"Video not ready"});}
});

app.listen(port,()=>console.log(`AI Video Studio v2: http://localhost:${port}`));
