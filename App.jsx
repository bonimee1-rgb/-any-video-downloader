import React,{useEffect,useMemo,useRef,useState}from'react';
import{Download,Link2,Pause,Play,Trash2,FolderDown,Settings,Search,CheckCircle2,AlertCircle,Clock3,Zap,ShieldCheck,Plus,RefreshCw,ExternalLink,Menu}from'lucide-react';
const DB='avdp-db',STORE='jobs';
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbGet(id){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbPut(v){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).put(v);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function dbAll(){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbDelete(id){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
const fmt=n=>{if(!Number.isFinite(n))return'—';const u=['B','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return`${n.toFixed(i?1:0)} ${u[i]}`;};
const shortName=u=>{try{return decodeURIComponent(new URL(u).pathname.split('/').pop()||'video-download').slice(0,90)}catch{return'video-download'}};
const MEDIA_EXT=/\.(mp4|m4v|mov|webm|mkv|avi|flv|wmv|3gp|ts|mp3|m4a|aac|ogg|opus|wav|flac)$/i;
function isDirectMedia(raw){try{return MEDIA_EXT.test(new URL(raw).pathname)}catch{return false}}
function platformFor(raw){try{if(isDirectMedia(raw))return null;const h=new URL(raw).hostname.replace(/^www\./,'').toLowerCase();return h||null}catch{return null}}
const apiBase=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
export default function App(){
 const [url,setUrl]=useState(''),[jobs,setJobs]=useState([]),[tab,setTab]=useState('all'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[dark,setDark]=useState(true);
 const controllers=useRef({});
 useEffect(()=>{dbAll().then(rows=>setJobs(rows.map(x=>({...x,controller:null,status:x.status==='downloading'?'paused':x.status})))) .catch(()=>{});},[]);
 const save=async j=>{const clean={...j,controller:undefined};await dbPut(clean);setJobs(prev=>{const i=prev.findIndex(x=>x.id===j.id);if(i<0)return[clean,...prev];const n=[...prev];n[i]=clean;return n;});};
 const tell=m=>{setNotice(m);setTimeout(()=>setNotice(''),4500);};
 async function add(){
   const v=url.trim();
   if(!/^https?:\/\//i.test(v)){tell('Please enter a valid http(s) link.');return;}
   const platform=platformFor(v);
   if(platform){
     
     setBusy(true);
     try{
       const r=await fetch(`${apiBase.replace(/\/$/,'')}/api/platform/info?url=${encodeURIComponent(v)}`);
       const data=await r.json();if(!r.ok)throw new Error(data.detail||'Could not inspect this link.');
       const id=crypto.randomUUID();
       await save({id,url:v,name:data.title||`${platform} video`,status:'ready',received:0,total:data.filesize||0,chunks:[],created:Date.now(),error:'',mime:'video/mp4',kind:'platform',platform,thumbnail:data.thumbnail||'',duration:data.duration||0});
       setUrl('');tell(`${platform} link detected. Use the download arrow to save the video.`);
     }catch(e){tell(e.message||'Platform service unavailable.');}
     finally{setBusy(false);}
     return;
   }
   const id=crypto.randomUUID();const j={id,url:v,name:shortName(v),status:'queued',received:0,total:0,chunks:[],created:Date.now(),error:'',mime:'application/octet-stream'};
   await save(j);setUrl('');tell('Added to download queue.');start(j);
 }
 async function start(job){
   if(controllers.current[job.id])return;
   const ctrl=new AbortController();controllers.current[job.id]=ctrl;
   let j=await dbGet(job.id)||job;let chunks=j.chunks||[];let offset=chunks.reduce((s,b)=>s+b.size,0);
   try{
     await save({...j,status:'downloading',error:''});
     const headers=offset?{Range:`bytes=${offset}-`}:{};
     const response=await fetch(j.url,{headers,signal:ctrl.signal});
     if(!(response.ok||response.status===206))throw new Error(`Server returned HTTP ${response.status}`);
     if(offset&&response.status!==206){chunks=[];offset=0;}
     const totalHeader=response.headers.get('content-range')?.split('/').pop();
     const total=Number(totalHeader)||Number(response.headers.get('content-length'))+offset||0;
     const mime=response.headers.get('content-type')||j.mime;
     const reader=response.body?.getReader();if(!reader)throw new Error('This browser cannot stream this response.');
     let received=offset;let lastSave=Date.now();
     while(true){const {done,value}=await reader.read();if(done)break;const part=value.slice();chunks.push(part);received+=part.byteLength;
       const now=Date.now();if(now-lastSave>650){j={...j,chunks,received,total,mime,status:'downloading'};await save(j);lastSave=now;}
     }
     j={...j,chunks,received,total,mime,status:'completed',finished:Date.now()};await save(j);tell('Download completed.');
   }catch(e){const current=await dbGet(job.id)||job;if(e.name==='AbortError'){await save({...current,status:'paused',error:''});}else{await save({...current,status:'error',error:e.message||'Download failed'});tell(e.message||'Download failed.');}}
   finally{delete controllers.current[job.id];}
 }
 async function platformDownload(j,kind='video'){
   
   try{
     await save({...j,status:'downloading',error:''});
     const endpoint=`${apiBase.replace(/\/$/,'')}/api/platform/download?url=${encodeURIComponent(j.url)}&kind=${kind}`;
     const r=await fetch(endpoint);
     if(!r.ok){let msg='Platform download failed.';try{msg=(await r.json()).detail||msg}catch{}throw new Error(msg);}
     const blob=await r.blob();
     const disp=r.headers.get('content-disposition')||'';
     const match=disp.match(/filename="?([^";]+)"?/i);
     const filename=match?match[1]:`${j.name||'video'}.${kind==='audio'?'mp3':'mp4'}`;
     const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
     await save({...j,name:filename,chunks:[blob],mime:blob.type||'video/mp4',status:'completed',received:blob.size,total:blob.size,error:'',finished:Date.now()});tell('Platform download completed.');
   }catch(e){await save({...j,status:'error',error:e.message||'Platform download failed'});tell(e.message||'Platform download failed.');}
 }
 function pause(j){controllers.current[j.id]?.abort();}
 async function remove(j){pause(j);await dbDelete(j.id);setJobs(p=>p.filter(x=>x.id!==j.id));}
 async function saveFile(j){const fresh=await dbGet(j.id);const blob=new Blob(fresh.chunks||[],{type:fresh.mime||'application/octet-stream'});const name=j.name||'download';const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name.includes('.')?name:`${name}.mp4`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 const filtered=useMemo(()=>jobs.filter(j=>tab==='all'||(tab==='active'?['queued','ready','downloading','paused'].includes(j.status):tab==='done'?j.status==='completed':j.status==='error')), [jobs,tab]);
 const count=jobs.filter(j=>j.status==='completed').length;
 return <div className={dark?'app':'app light'}>
  <aside className="sidebar"><div className="brand"><div className="brandIcon"><Download size={23}/></div><div><b>ANY VIDEO</b><small>DOWNLOADER PRO</small></div></div><div className="sideLabel">WORKSPACE</div>{[['all','Overview'],['active','In progress'],['done','Completed'],['error','Failed']].map(([k,n])=><button key={k} className={`sideBtn ${tab===k?'selected':''}`} onClick={()=>setTab(k)}><FolderDown size={18}/>{n}<span>{k==='all'?jobs.length:k==='done'?count:k==='active'?jobs.filter(j=>['queued','ready','downloading','paused'].includes(j.status)).length:jobs.filter(j=>j.status==='error').length}</span></button>)}<div className="sideBottom"><div className="secure"><ShieldCheck size={18}/><div><b>Safe downloads</b><small>Only download content you have permission to save.</small></div></div><button className="sideBtn" onClick={()=>setDark(!dark)}><Settings size={18}/>Appearance <span>{dark?'Dark':'Light'}</span></button></div></aside>
  <main className="main"><header><div className="mobileBrand"><div className="brandIcon"><Download size={20}/></div><b>Any Video Downloader Pro</b></div><div className="topRight"><span className="online"><i/> Ready</span><button className="iconBtn" title="Toggle theme" onClick={()=>setDark(!dark)}><span>◐</span></button></div></header>
  <section className="welcome"><div><div className="eyebrow"><Zap size={14}/> SMART DOWNLOAD MANAGER</div><h1>Download at your pace<span>.</span></h1><p>Paste any public video link from almost any website, or a direct media file link.</p></div><div className="heroOrb"><Download size={42}/></div></section>
  <section className="pasteCard"><div className="pasteHead"><div><b><Link2 size={17}/> Add a download</b><small>Paste any video link</small></div><span className="protocol">HTTP / HTTPS</span></div><div className="urlRow"><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="https://… any video link"/><button className="primary" onClick={add} disabled={busy}><Plus size={17}/> {busy?"Checking…":"Add URL"}</button></div><div className="pasteHint">Direct files download in-browser (pause/resume). Links from other sites (YouTube, TikTok, Facebook, Instagram, Vimeo, X, Reddit and 1000+ more) are handled automatically. DRM and login-protected media are not supported.</div></section>
  <section className="stats"><div className="stat"><div className="statIcon blue"><Download size={18}/></div><div><small>Total downloads</small><b>{jobs.length}</b></div></div><div className="stat"><div className="statIcon green"><CheckCircle2 size={18}/></div><div><small>Completed</small><b>{count}</b></div></div><div className="stat"><div className="statIcon purple"><RefreshCw size={18}/></div><div><small>Resume ready</small><b>{jobs.filter(j=>j.status==='paused').length}</b></div></div></section>
  <section className="listSection"><div className="listHead"><div><h2>Download queue</h2><p>Manage and track your files</p></div><div className="filterPills">{[['all','All'],['active','Active'],['done','Done']].map(([k,n])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{n}</button>)}</div></div>
  <div className="jobList">{filtered.length===0?<div className="empty"><div className="emptyIcon"><Download size={26}/></div><b>No downloads here yet</b><p>Paste a video link to get started.</p></div>:filtered.map(j=>{const pct=j.total?Math.min(100,j.received/j.total*100):0;return <article className="job" key={j.id}><div className="fileIcon"><Play size={19}/></div><div className="jobBody"><div className="jobTitle"><b title={j.name}>{j.name}</b><span className={`status ${j.status}`}>{j.status}</span></div><div className="jobUrl">{j.url}</div><div className="progress"><i style={{width:`${pct}%`}}/></div><div className="jobMeta"><span>{fmt(j.received)}{j.total?` / ${fmt(j.total)}`:''}</span><span>{j.status==='completed'?'100%':j.total?`${pct.toFixed(1)}%`:j.status==='downloading'?'Receiving data…':'—'}</span></div>{j.error&&<div className="errorText"><AlertCircle size={13}/>{j.error}</div>}</div><div className="jobActions">{j.status==='completed'?<button className="action good" onClick={()=>saveFile(j)} title="Save file"><Download size={17}/></button>:j.status==='downloading'?<button className="action" onClick={()=>pause(j)} title="Pause"><Pause size={17}/></button>:j.kind==='platform'?<><button className="action" onClick={()=>platformDownload(j,'video')} title="Download video"><Download size={17}/></button><button className="action" onClick={()=>platformDownload(j,'audio')} title="Download MP3" style={{fontSize:11,fontWeight:700}}>MP3</button></>:<button className="action" onClick={()=>start(j)} title="Resume"><Play size={17}/></button>}<button className="action danger" onClick={()=>remove(j)} title="Remove"><Trash2 size={17}/></button></div></article>})}</div></section>
  <footer><span>© 2026 Any Video Downloader Pro</span><span><ShieldCheck size={14}/> Private download manager</span></footer>
  </main>{notice&&<div className="toast">{notice}</div>}
 </div>;
}