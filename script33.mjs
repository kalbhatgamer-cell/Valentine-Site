
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, getDocs, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL='kalbhatgamer@gmail.com';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function waitUser(ms=3000){
  if(auth.currentUser)return Promise.resolve(auth.currentUser);
  return new Promise(resolve=>{
    let done=false;
    const unsub=onAuthStateChanged(auth,u=>{if(done)return;done=true;try{unsub();}catch(e){}resolve(u||auth.currentUser||null);});
    setTimeout(()=>{if(done)return;done=true;try{unsub();}catch(e){}resolve(auth.currentUser||null);},ms);
  });
}
function isAdmin(){return String(auth.currentUser?.email||'').toLowerCase()===ADMIN_EMAIL;}
function maintStatus(msg,bad=false){const box=$('kalbAdminAppControlStatus'); if(box)box.innerHTML=`<div class="kalb-maint-final-status ${bad?'err':''}">${esc(msg)}</div>`;}
function applyMaintenanceUI(enabled,message){
  const st=$('kalbAdminMaintenanceState'), msg=$('kalbAdminMaintenanceMessage');
  if(st)st.value=enabled?'on':'off';
  if(msg && message!=null)msg.value=message;
  const data={enabled:!!enabled,message:message||'We are improving Kalb Message. Please come back soon.',updatedLocal:Date.now()};
  ['kalbMaintenanceBackup','kalbMaintenanceLocalOverride','kalbMaintenanceStatus','kalbAppMaintenanceStatus'].forEach(k=>{try{localStorage.setItem(k,JSON.stringify(data));}catch(e){}});
  const overlay=$('kalbMaintenanceOverlay');
  if(overlay)overlay.style.display=(enabled&&!isAdmin())?'flex':'none';
  const om=$('kalbMaintenanceOverlayMessage'); if(om)om.innerText=data.message;
}
async function hardSaveMaintenance(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}
  const u=await waitUser();
  if(!u || String(u.email||'').toLowerCase()!==ADMIN_EMAIL){alert('Admin only. Login with kalbhatgamer@gmail.com.');return;}
  const enabled=String($('kalbAdminMaintenanceState')?.value||'off').toLowerCase()==='on';
  const message=($('kalbAdminMaintenanceMessage')?.value||'We are improving Kalb Message. Please come back soon.').trim();
  applyMaintenanceUI(enabled,message);
  maintStatus(`Saving Maintenance ${enabled?'ON':'OFF'}...`);
  const payload={enabled,active:enabled,isOn:enabled,maintenance:enabled,status:enabled?'on':'off',message,updatedAt:serverTimestamp(),updatedBy:u.email,source:'critical-bug-pack-final'};
  const refs=[['appConfig','maintenance'],['settings','maintenance'],['publicConfig','maintenance'],['adminConfig','maintenance'],['appSettings','maintenance'],['config','maintenance'],['global','maintenance'],['public','maintenance'],['maintenance','status']];
  let ok=0, errs=[];
  for(const [a,b] of refs){
    try{await setDoc(doc(db,a,b),payload,{merge:true});ok++;}
    catch(e){errs.push(`${a}/${b}: ${e.code||e.message||e}`);}
  }
  applyMaintenanceUI(enabled,message);
  let mainOk=false;
  try{const snap=await getDoc(doc(db,'appConfig','maintenance')); mainOk=snap.exists() && (snap.data()||{}).enabled===enabled;}catch(e){}
  if(!enabled){
    try{document.querySelectorAll('[id*="MaintenanceOverlay"],.maintenance-overlay,.kalb-maintenance-overlay').forEach(el=>{el.style.display='none';});}catch(e){}
  }
  maintStatus(mainOk?`Maintenance ${enabled?'ON':'OFF'} saved correctly.`:`Maintenance ${enabled?'ON':'OFF'} saved on ${ok} place(s). Refresh Status to confirm.${errs.length?' First error: '+errs[0]:''}`,!mainOk);
}
async function hardLoadMaintenance(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}
  try{
    const snap=await getDoc(doc(db,'appConfig','maintenance'));
    const d=snap.exists()?(snap.data()||{}):{enabled:false,message:'We are improving Kalb Message. Please come back soon.'};
    applyMaintenanceUI(d.enabled===true,d.message||'We are improving Kalb Message. Please come back soon.');
    maintStatus(`Maintenance status loaded: ${d.enabled===true?'ON':'OFF'}.`);
  }catch(e){maintStatus(e.code||e.message||'Could not load maintenance status.',true);}
}
window.kalbAdminSaveMaintenance=hardSaveMaintenance;
window.kalbAdminLoadMaintenance=hardLoadMaintenance;
function bindMaintButtons(){
  document.querySelectorAll('button').forEach(btn=>{
    const t=(btn.textContent||'').toLowerCase(); const on=(btn.getAttribute('onclick')||'').toLowerCase();
    if(t.includes('save maintenance')||on.includes('kalbadminsavemaintenance')){btn.onclick=null;if(!btn.dataset.maintCriticalBound){btn.dataset.maintCriticalBound='1';btn.addEventListener('click',hardSaveMaintenance,true);}}
    if(t.includes('refresh status')||on.includes('kalbadminloadmaintenance')){btn.onclick=null;if(!btn.dataset.maintCriticalLoad){btn.dataset.maintCriticalLoad='1';btn.addEventListener('click',hardLoadMaintenance,true);}}
  });
}
function patchPostDom(){
  document.querySelectorAll('.post-box,.feed-post,.post-card').forEach(box=>{
    const text=(box.textContent||'').toLowerCase();
    let postId=box.getAttribute('data-post-id')||box.dataset?.id||box.id?.replace(/^post[-_]/,'')||'';
    const anyBtn=[...box.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('kalbToggleComments')||(b.textContent||'').toLowerCase().includes('comment'));
    const action=box.querySelector('.post-actions,.actions')||box;
    if(postId && !anyBtn && !text.includes('no posts yet')){
      const b=document.createElement('button');
      b.className='btn alt';
      b.type='button';
      b.textContent='Comments (0)';
      b.addEventListener('click',()=>window.kalbToggleComments(postId));
      action.appendChild(b);
    }
  });
}
window.kalbToggleComments=async function(postId){
  postId=String(postId||'').trim(); if(!postId)return;
  const panelId='kalbFixedComments_'+postId;
  let panel=$(panelId);
  if(!panel){
    const boxes=[...document.querySelectorAll('.post-box,.feed-post,.post-card')];
    const box=boxes.find(b=>(b.getAttribute('data-post-id')||b.dataset?.id||b.id?.replace(/^post[-_]/,''))===postId)||document.body;
    panel=document.createElement('div'); panel.id=panelId; panel.className='kalb-fixed-comment-panel';
    box.appendChild(panel);
  }
  if(panel.style.display==='block'){panel.style.display='none';return;}
  panel.style.display='block';
  panel.innerHTML='<div>Loading comments...</div>';
  try{
    const qs=await getDocs(query(collection(db,'posts',postId,'comments'),orderBy('createdAt','asc')));
    const rows=[]; qs.forEach(d=>rows.push({id:d.id,...(d.data()||{})}));
    panel.innerHTML=`<div class="kalb-fixed-comment-list">${rows.length?rows.map(c=>`<div class="kalb-fixed-comment-row"><b>${esc(c.name||c.username||'User')}</b><br>${esc(c.text||'')}</div>`).join(''):'<div>No comments yet.</div>'}</div><textarea id="kalbCommentText_${esc(postId)}" placeholder="Write a comment..." style="margin-top:10px;min-height:70px"></textarea><button class="btn" type="button" id="kalbCommentSend_${esc(postId)}">Post Comment</button>`;
    const send=$('kalbCommentSend_'+postId);
    if(send)send.onclick=async()=>{
      const u=await waitUser(); if(!u)return alert('Login first.');
      const input=$('kalbCommentText_'+postId); const val=(input?.value||'').trim(); if(!val)return;
      await addDoc(collection(db,'posts',postId,'comments'),{text:val,uid:u.uid,email:u.email||'',name:u.displayName||u.email?.split('@')[0]||'User',createdAt:serverTimestamp()});
      input.value=''; panel.style.display='none'; window.kalbToggleComments(postId);
    };
  }catch(e){panel.innerHTML='<div>Could not load comments.</div>';}
};
// Extra reaction fallback for older post cards that still call the old function.
window.kalbFeedFixReact=async function(postId,emoji){
  const u=await waitUser(); if(!u)return alert('Login first.');
  const ref=doc(db,'posts',postId); const snap=await getDoc(ref); const d=snap.exists()?(snap.data()||{}):{};
  const emojis=['❤️','😂','😮','😢','👍']; const had=((d.reactions||{})[emoji]||[]).includes(u.uid); const patch={};
  emojis.forEach(e=>patch[`reactions.${e}`]=arrayRemove(u.uid)); if(!had)patch[`reactions.${emoji}`]=arrayUnion(u.uid);
  await updateDoc(ref,patch);
};
function bindEverything(){bindMaintButtons();patchPostDom();}
document.addEventListener('DOMContentLoaded',bindEverything);
window.addEventListener('load',()=>setTimeout(bindEverything,400));
setInterval(bindEverything,1800);
const oldPage=window.openPage;
if(oldPage&&!oldPage.__criticalBugPack){window.openPage=function(){const r=oldPage.apply(this,arguments);setTimeout(bindEverything,250);setTimeout(bindEverything,900);return r;};window.openPage.__criticalBugPack=true;}
