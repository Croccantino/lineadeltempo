const KEY="timeline-proporzionale-v3";
const COLORS=[["blue","Blu"],["green","Verde"],["red","Rosso"],["yellow","Giallo"]];
const W=140,LH=54,PAD=14,LAB=110;
const ev=(id,r,y,t,col)=>({id,r,y,t,n:"",col});
let S={ppy:0,
rows:[{id:"r1",name:"Inghilterra"},{id:"r2",name:"Francia"},{id:"r3",name:"Germania"}],
ev:[ev("e1","r1",1998,"Evento A","blue"),ev("e2","r1",2010,"Evento B","red"),
ev("e3","r2",1992,"Evento C","green"),ev("e4","r2",2004,"Evento D","yellow"),
ev("e5","r3",2001,"Evento E","blue"),ev("e6","r3",2015,"Evento F","green")]};
try{const s=localStorage.getItem(KEY);if(s)S=JSON.parse(s)}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const uid=p=>p+Math.random().toString(36).slice(2,8);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const $=id=>document.getElementById(id);
let cur=null,yMin=1990,curImg="",curLink="";
const EDIT_MODE=!!$("addEv");
const MAX_IMG_CHARS=Math.floor(600*1024*1.37);
const isDataImg=v=>/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(v);
function safeHttpUrl(v){v=String(v||"").trim();if(!v)return"";try{const u=new URL(v);return(u.protocol==="http:"||u.protocol==="https:")?u.href:""}catch(e){return""}}
const safeImgUrl=v=>{v=String(v||"").trim();return isDataImg(v)?v:safeHttpUrl(v)};
const safeLink=v=>safeHttpUrl(v);

function resizeImageFile(file,maxSide=1000,quality=.72){
return new Promise((resolve,reject)=>{
if(!file||!file.type.startsWith("image/")){reject(new Error("Il file selezionato non è un'immagine."));return}
const r=new FileReader();
r.onerror=()=>reject(new Error("Lettura del file non riuscita."));
r.onload=()=>{
const im=new Image();
im.onerror=()=>reject(new Error("Immagine non valida."));
im.onload=()=>{
const ratio=Math.min(1,maxSide/Math.max(im.width,im.height));
const w=Math.max(1,Math.round(im.width*ratio)),h=Math.max(1,Math.round(im.height*ratio));
const c=document.createElement("canvas");c.width=w;c.height=h;
const ctx=c.getContext("2d");
if(!ctx){reject(new Error("Canvas non disponibile."));return}
ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.drawImage(im,0,0,w,h);
let out=c.toDataURL("image/jpeg",quality),q=quality;
while(out.length>MAX_IMG_CHARS&&q>.4){q=Math.max(.4,q-.1);out=c.toDataURL("image/jpeg",q)}
if(out.length>MAX_IMG_CHARS){reject(new Error("Immagine troppo grande anche dopo la compressione. Usa un file più piccolo o un URL."));return}
resolve(out);
};
im.src=String(r.result);
};
r.readAsDataURL(file);
});
}

function updateImgPreview(src){
const wrap=$("imgPrevWrap"),img=$("imgPrev");
if(!wrap||!img)return;
if(src){img.src=src;wrap.hidden=false}else{img.removeAttribute("src");wrap.hidden=true}
}

function range(){
const ys=S.ev.map(e=>e.y).filter(Number.isFinite);
if(!ys.length)return[2000,2020];
let a=Math.min(...ys),b=Math.max(...ys);
if(a===b)b=a+1;
return[a,b];
}
function fit(){const[a,b]=range();S.ppy=Math.max(6,Math.min(60,640/(b-a)))}
function step(ppy){for(const s of [1,2,5,10,20,50,100,200,500,1000])if(s*ppy>=64)return s;return 1000}

function render(){
if(!S.ppy)fit();
const[a,b]=range();yMin=a;
const ppy=S.ppy,width=(b-a)*ppy+PAD+W+24;
const X=y=>(y-a)*ppy+PAD;
const st=step(ppy);
let ticks="";
for(let t=Math.ceil(a/st)*st;t<=b;t+=st)ticks+=`<div class="tick" style="left:${X(t)}px"><i>${t}</i></div>`;
const plain=ticks.replace(/<i>\d+<\/i>/g,"");
let h=`<div class="line"><div class="lab"></div><div class="trk axis" style="width:${width}px">${ticks}</div></div>`;
for(const r of S.rows){
const items=S.ev.filter(e=>e.r===r.id&&Number.isFinite(e.y)).sort((p,q)=>p.y-q.y);
const lanes=[];let chips="";
for(const e of items){
const x=X(e.y);let l=lanes.findIndex(end=>end<=x);
if(l<0){l=lanes.length;lanes.push(0)}
lanes[l]=x+W+6;
chips+=`<button class="chip c-${e.col}" data-e="${e.id}" style="left:${x}px;top:${6+l*LH}px"><b>${e.y}</b><span>${esc(e.t)}</span></button>`;
}
const hgt=Math.max(1,lanes.length)*LH+10;
h+=`<div class="line" style="height:${hgt}px"><div class="lab"><button data-hr="${r.id}">${esc(r.name)}</button></div><div class="trk" data-r="${r.id}" style="width:${width}px">${plain}${chips}</div></div>`;
}
$("tl").innerHTML=h;
}

function openDlg(e,r,y){
cur=e?{...e}:{id:uid("e"),r:r||S.rows[0].id,y:y??"",t:"",n:"",col:"blue"};
$("dt").textContent=e?"Modifica evento":"Nuovo evento";
$("p").innerHTML=S.rows.map(x=>`<option value="${x.id}" ${x.id===cur.r?"selected":""}>${esc(x.name)}</option>`).join("");
$("y").value=cur.y;$("t").value=cur.t;$("n").value=cur.n;
$("sw").innerHTML=COLORS.map(([k,l])=>`<label><input type="radio" name="col" value="${k}" ${cur.col===k?"checked":""}>${l}</label>`).join("");
$("del").style.display=e?"":"none";
curImg=cur.img||"";curLink=cur.link||"";
if($("img"))$("img").value=isDataImg(curImg)?"":curImg;
if($("lnk"))$("lnk").value=curLink;
if($("imgFile"))$("imgFile").value="";
updateImgPreview(curImg);
$("dlg").showModal();
}

function openInfo(e){
  const box=$("infoDlg");
  if(!box)return;
  const row=S.rows.find(r=>r.id===e.r);
  $("iNote").className="note c-"+(e.col||"blue");
  $("iY").textContent=e.y;
  $("iT").textContent=e.t;
  $("iP").textContent=row?"Paese: "+row.name:"";
  $("iN").textContent=e.n||"Nessun appunto registrato per questo evento.";

  const img=safeImgUrl(e.img),link=safeLink(e.link);
  const photoLink=$("iPhotoLink"),photo=$("iPhoto");
  if(photoLink&&photo){
    if(img){
      photo.src=img;photo.alt=e.t;
      photoLink.hidden=false;
      photoLink.classList.remove("zoomed");
      photo.onerror=()=>{photoLink.hidden=true};
      if(isDataImg(img)){
        photoLink.removeAttribute("href");
        photoLink.removeAttribute("target");
        photoLink.setAttribute("data-zoom","1");
        photoLink.setAttribute("role","button");
        photoLink.tabIndex=0;
        photoLink.onclick=()=>photoLink.classList.toggle("zoomed");
        photoLink.onkeydown=ev=>{
          if((ev.key==="Enter"||ev.key===" ")&&photoLink.dataset.zoom){ev.preventDefault();photoLink.classList.toggle("zoomed")}
        };
      }else{
        photoLink.setAttribute("href",img);
        photoLink.setAttribute("target","_blank");
        photoLink.removeAttribute("data-zoom");
        photoLink.removeAttribute("role");
        photoLink.removeAttribute("tabindex");
        photoLink.onclick=null;
        photoLink.onkeydown=null;
      }
    }else{
      photo.removeAttribute("src");photo.alt="";photoLink.hidden=true;
      photoLink.removeAttribute("href");photoLink.classList.remove("zoomed");
    }
  }
  const linkEl=$("iLink");
  if(linkEl){
    if(link){linkEl.href=link;linkEl.hidden=false}
    else{linkEl.removeAttribute("href");linkEl.hidden=true}
  }
  box.showModal();
}

$("tl").addEventListener("click",x=>{
const b=x.target.closest("button");
if(b&&b.dataset.e){
  const found=S.ev.find(o=>o.id===b.dataset.e);
  if(!found)return;
  if(EDIT_MODE)openDlg(found);else openInfo(found);
  return;
}
if(!EDIT_MODE)return;
if(b&&b.dataset.hr){const o=S.rows.find(q=>q.id===b.dataset.hr),n=prompt("Nome del paese",o.name);if(n){o.name=n;save();render()}return}
if(x.target.classList.contains("trk")&&x.target.dataset.r){
openDlg(null,x.target.dataset.r,Math.round(yMin+(x.offsetX-PAD)/S.ppy));
}
});
$("f").addEventListener("submit",()=>{
if(!EDIT_MODE)return;
const col=(document.querySelector("input[name=col]:checked")||{}).value||"blue";
const e={id:cur.id,r:$("p").value,y:parseInt($("y").value,10),t:$("t").value.trim(),n:$("n").value.trim(),col};
const img=safeImgUrl(curImg),link=safeLink(curLink);
if(img)e.img=img;if(link)e.link=link;
const i=S.ev.findIndex(o=>o.id===e.id);
if(i>=0)S.ev[i]=e;else S.ev.push(e);
save();render();
});
if(EDIT_MODE)$("del").onclick=()=>{S.ev=S.ev.filter(o=>o.id!==cur.id);save();render();$("dlg").close()};
$("close").onclick=()=>$("dlg").close();
$("imgFile")&&($("imgFile").onchange=async ev=>{
const f=ev.target.files&&ev.target.files[0];if(!f)return;
try{curImg=await resizeImageFile(f);if($("img"))$("img").value="";updateImgPreview(curImg)}
catch(err){alert("Impossibile caricare l'immagine: "+err.message)}
});
$("img")&&($("img").oninput=()=>{curImg=$("img").value;updateImgPreview(curImg)});
$("lnk")&&($("lnk").oninput=()=>{curLink=$("lnk").value});
$("imgClear")&&($("imgClear").onclick=()=>{curImg="";if($("img"))$("img").value="";if($("imgFile"))$("imgFile").value="";updateImgPreview("")});
const infoDlg=$("infoDlg");
if(infoDlg){infoDlg.addEventListener("click",x=>{if(x.target===infoDlg)infoDlg.close()});$("iClose").onclick=()=>infoDlg.close()}
$("addEv")&&($("addEv").onclick=()=>openDlg(null));
$("zi").onclick=()=>{S.ppy=Math.min(200,S.ppy*1.4);save();render()};
$("zo").onclick=()=>{S.ppy=Math.max(1,S.ppy/1.4);save();render()};
$("fit").onclick=()=>{fit();save();render()};
$("addRow")&&($("addRow").onclick=()=>{const n=prompt("Nome del paese");if(n){S.rows.push({id:uid("r"),name:n});save();render()}});
render();
