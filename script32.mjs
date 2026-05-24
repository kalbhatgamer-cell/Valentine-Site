
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL='kalbhatgamer@gmail.com';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const adminOk=()=>!!(auth.currentUser&&String(auth.currentUser.email||'').toLowerCase()===ADMIN_EMAIL);
const paths=[['appConfig','maintenance'],['settings','maintenance'],['publicConfig','maintenance'],['adminConfig','maintenance']];
function status(msg,bad=false){
  const box=$('kalbAdminAppControlStatus');
  if(box) box.innerHTML=`<div class="kalb-maint-final-status ${bad?'err':''}">${esc(msg)}</div>`;
}
function getState(){
  const state=$('kalbAdminMaintenanceState');
  const msg=$('kalbAdminMaintenanceMessage');
  return {
    enabled: String(state?.value||'off').toLowerCase()==='on',
    message: (msg?.value||'We are improving Kalb Message. Please come back soon.').trim()
  };
}
function applyLocal(data){
  try{localStorage.setItem('kalbMaintenanceBackup',JSON.stringify({...data,updatedLocal:Date.now()}));}catch(e){}
  try{localStorage.setItem('kalbMaintenanceLocalOverride',JSON.stringify({...data,updatedLocal:Date.now()}));}catch(e){}
  if($('kalbAdminMaintenanceState')) $('kalbAdminMaintenanceState').value=data.enabled?'on':'off';
  if($('kalbAdminMaintenanceMessage')) $('kalbAdminMaintenanceMessage').value=data.message||'';
  if($('kalbMaintenanceOverlay')) $('kalbMaintenanceOverlay').style.display=(data.enabled&&!adminOk())?'flex':'none';
  if($('kalbMaintenanceOverlayMessage')) $('kalbMaintenanceOverlayMessage').innerText=data.message||'We are improving Kalb Message. Please come back soon.';
}
async function saveToServer(data){
  const payload={enabled:data.enabled,message:data.message,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||'',source:'admin-maintenance-final-fix'};
  const results=[];
  for(const p of paths){
    try{await setDoc(doc(db,p[0],p[1]),payload,{merge:true});results.push({path:p.join('/'),ok:true});}
    catch(e){results.push({path:p.join('/'),ok:false,error:e.code||e.message||String(e)});}
  }
  return results;
}
async function verifyMainDoc(expectedEnabled){
  try{
    const snap=await getDoc(doc(db,'appConfig','maintenance'));
    if(!snap.exists()) return {ok:false,reason:'appConfig/maintenance not found'};
    const data=snap.data()||{};
    return {ok:data.enabled===expectedEnabled,data};
  }catch(e){return {ok:false,reason:e.code||e.message||String(e)};}
}
async function finalSaveMaintenance(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  if(!adminOk()){alert('Admin only. Login with kalbhatgamer@gmail.com.');return;}
  const data=getState();
  applyLocal(data);
  status(`Saving Maintenance ${data.enabled?'ON':'OFF'}...`);
  const results=await saveToServer(data);
  const saved=results.filter(r=>r.ok).map(r=>r.path);
  applyLocal(data);
  const verified=await verifyMainDoc(data.enabled);
  if(saved.length && verified.ok){
    status(`Maintenance ${data.enabled?'ON':'OFF'} saved correctly.`);
  }else if(saved.length){
    status(`Saved to: ${saved.join(', ')}. If it changes back, update Firebase rules for appConfig/maintenance.`, true);
  }else{
    const firstErr=results.find(r=>!r.ok)?.error||'permission denied';
    status(`Could not save globally (${firstErr}). I turned it ${data.enabled?'ON':'OFF'} on this device only. Firebase rules must allow admin write to appConfig/maintenance.`, true);
  }
}
async function finalLoadMaintenance(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  try{
    const snap=await getDoc(doc(db,'appConfig','maintenance'));
    if(snap.exists()){
      const data=snap.data()||{};
      applyLocal({enabled:data.enabled===true,message:data.message||'We are improving Kalb Message. Please come back soon.'});
      status(`Maintenance status loaded: ${data.enabled===true?'ON':'OFF'}.`);
    }else{
      applyLocal({enabled:false,message:'We are improving Kalb Message. Please come back soon.'});
      status('Maintenance status loaded: OFF.');
    }
  }catch(e){
    status(e.code||e.message||'Could not load maintenance status.', true);
  }
}
window.kalbAdminSaveMaintenance=finalSaveMaintenance;
window.kalbAdminLoadMaintenance=finalLoadMaintenance;
function bindButtons(){
  const buttons=[...document.querySelectorAll('button')];
  buttons.forEach(btn=>{
    const text=(btn.textContent||'').trim().toLowerCase();
    const attr=String(btn.getAttribute('onclick')||'').toLowerCase();
    if(text.includes('save maintenance')||attr.includes('kalbadminsavemaintenance')){
      btn.onclick=null;
      if(!btn.dataset.kalbMaintFinalBound){
        btn.dataset.kalbMaintFinalBound='1';
        btn.addEventListener('click',finalSaveMaintenance,true);
      }
    }
    if(text.includes('refresh status')||attr.includes('kalbadminloadmaintenance')){
      btn.onclick=null;
      if(!btn.dataset.kalbMaintFinalLoadBound){
        btn.dataset.kalbMaintFinalLoadBound='1';
        btn.addEventListener('click',finalLoadMaintenance,true);
      }
    }
  });
}
function boot(){bindButtons();setTimeout(bindButtons,400);setTimeout(bindButtons,1200);}
document.addEventListener('DOMContentLoaded',boot);
window.addEventListener('load',boot);
onAuthStateChanged(auth,()=>setTimeout(boot,500));
const oldOpen=window.openPage;
if(oldOpen&&!oldOpen.__maintFinalFix){
  window.openPage=function(){const r=oldOpen.apply(this,arguments);setTimeout(boot,250);setTimeout(boot,900);return r;};
  window.openPage.__maintFinalFix=true;
}
setInterval(bindButtons,2500);
