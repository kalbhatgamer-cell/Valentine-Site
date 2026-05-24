
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL="kalbhatgamer@gmail.com";
const esc=v=>String(v??"").replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
function uidOf(u){return String(u?.uid||u?.id||u?.userId||u?.docId||u?.__docId||"");}
function baseId(uid,salt=""){
  let h=2166136261>>>0, str=String(uid||"")+String(salt||"");
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return "KLB-"+String(h%1000000).padStart(6,"0");
}
function fixedIdOf(u){return String(u?.kalbId||baseId(uidOf(u))).toUpperCase();}
function isAdminNow(){
  const u=auth.currentUser||window.currentUser||null;
  const email=String(u?.email||window.currentUserProfile?.email||"").toLowerCase();
  if(email===ADMIN_EMAIL) return true;
  const p=window.currentUserProfile||{};
  return p.role==="admin"||p.admin===true||p.isAdmin===true||p.email===ADMIN_EMAIL;
}
async function getUsersFresh(){
  const snap=await getDocs(collection(db,"users"));
  const users=[]; snap.forEach(d=>users.push({__docId:d.id,uid:d.id,id:d.id,...d.data()}));
  window.allUsers=users;
  const me=auth.currentUser||window.currentUser;
  if(me){
    const found=users.find(u=>uidOf(u)===me.uid);
    if(found) window.currentUserProfile={...(window.currentUserProfile||{}),...found};
  }
  return users;
}
async function ensureFixedIds(){
  const users=await getUsersFresh();
  const used=new Set(users.map(u=>String(u.kalbId||"").toUpperCase()).filter(Boolean));
  const sorted=[...users].sort((a,b)=>uidOf(a).localeCompare(uidOf(b)));
  for(const u of sorted){
    const uid=uidOf(u); if(!uid) continue;
    if(u.kalbId){u.kalbId=String(u.kalbId).toUpperCase(); continue;}
    let id=baseId(uid), salt=1;
    while(used.has(id)){id=baseId(uid,"-"+(salt++));}
    used.add(id); u.kalbId=id;
    try{await setDoc(doc(db,"users",uid),{kalbId:id},{merge:true});}catch(e){console.warn("Kalb ID save failed",uid,e);}
  }
  buildPicker(users); updateVisibleIds(users);
  return users;
}
function buildPicker(users=window.allUsers||[]){
  const input=document.getElementById("badgeUserIdInput"); if(!input) return;
  input.placeholder="Kalb ID / UID / email";
  let picker=document.getElementById("badgeUserPicker");
  if(!picker){
    picker=document.createElement("select"); picker.id="badgeUserPicker";
    input.insertAdjacentElement("afterend",picker);
    picker.addEventListener("change",()=>{ if(picker.value) input.value=picker.value; });
  }
  picker.innerHTML='<option value="">Select user by Kalb ID</option>'+users.filter(u=>uidOf(u)).map(u=>{
    const name=u.name||u.displayName||u.username||(u.email?String(u.email).split("@")[0]:"User");
    return `<option value="${esc(fixedIdOf(u))}">${esc(name)} — ${esc(fixedIdOf(u))}</option>`;
  }).join("");
}
function updateVisibleIds(users=window.allUsers||[]){
  const currentUid=window.__kalbViewingUid||window.viewingProfileUid||window.selectedProfileUid||window.viewedProfileUser?.uid||window.currentUser?.uid||auth.currentUser?.uid;
  const u=users.find(x=>uidOf(x)===currentUid)||window.currentUserProfile||{};
  const id=fixedIdOf(u);
  document.querySelectorAll("#visibleKalbIdLine,.kalb-visible-profile-id").forEach(x=>x.remove());
  const emailLine=document.getElementById("viewProfileEmail")||document.getElementById("profileEmail");
  if(emailLine && id) emailLine.insertAdjacentHTML("afterend",`<p id="visibleKalbIdLine" class="kalb-id-line kalb-visible-profile-id">ID: ${esc(id)}</p>`);
  users.forEach(user=>{
    const uid=uidOf(user); if(!uid) return;
    document.querySelectorAll(`[data-user-uid="${uid.replace(/"/g,'\\"')}"]`).forEach(card=>{
      let line=card.querySelector(".kalb-id-line");
      if(!line){
        const holder=card.querySelector(".user-info,.user-details")||card;
        line=document.createElement("div"); line.className="kalb-id-line"; holder.appendChild(line);
      }
      line.textContent="ID: "+fixedIdOf(user);
    });
  });
}
async function resolveTarget(){
  const raw=String(document.getElementById("badgeUserIdInput")?.value||document.getElementById("badgeUserPicker")?.value||"").trim();
  if(!raw) return "";
  const v=raw.toLowerCase();
  const users=await ensureFixedIds();
  const found=users.find(u=>[uidOf(u),fixedIdOf(u),u.email,u.username,u.name,u.displayName].filter(Boolean).some(x=>String(x).trim().toLowerCase()===v));
  return found?uidOf(found):raw;
}
async function changeBadge(add){
  if(!isAdminNow()) return alert("Admin only.");
  const uid=await resolveTarget();
  const badge=document.getElementById("badgeTypeInput")?.value;
  if(!uid||!badge) return alert("Select user and badge.");
  const users=window.allUsers||[];
  const user=users.find(u=>uidOf(u)===uid)||{};
  let badges=Array.isArray(user.badges)?[...user.badges]:[];
  if(add){ if(!badges.includes(badge)) badges.push(badge); } else { badges=badges.filter(x=>x!==badge); }
  const data={badges};
  if(badge==="verified") data.verified=add;
  if(badge==="creator") data.creator=add;
  if(badge==="moderator") data.moderator=add;
  if(badge==="banned") data.banned=add;
  await updateDoc(doc(db,"users",uid),data);
  const local=(window.allUsers||[]).find(u=>uidOf(u)===uid); if(local) Object.assign(local,data);
  try{if(typeof window.renderAdminPanel==="function") window.renderAdminPanel();}catch(e){}
  try{if(typeof window.applyProfileBadgesFinal==="function") window.applyProfileBadgesFinal();}catch(e){}
  alert(add?"Badge added.":"Badge removed.");
}
window.isKalbAdminFixed=isAdminNow;
window.adminAddBadgeFinal=()=>changeBadge(true).catch(e=>{console.error(e);alert("Badge add failed: "+(e.message||e));});
window.adminRemoveBadgeFinal=()=>changeBadge(false).catch(e=>{console.error(e);alert("Badge remove failed: "+(e.message||e));});
const oldView=window.viewUserProfile;
if(typeof oldView==="function"&&!window.__kalbViewProfileIdWrapped){
  window.__kalbViewProfileIdWrapped=true;
  window.viewUserProfile=async function(uid){window.__kalbViewingUid=uid; const r=await oldView.apply(this,arguments); setTimeout(()=>ensureFixedIds().catch(console.error),250); return r;};
}
const oldOpen=window.openPage;
if(typeof oldOpen==="function"&&!window.__kalbOpenIdWrapped){
  window.__kalbOpenIdWrapped=true;
  window.openPage=function(){const r=oldOpen.apply(this,arguments); setTimeout(()=>ensureFixedIds().catch(()=>{}),250); return r;};
}
onAuthStateChanged(auth,()=>setTimeout(()=>ensureFixedIds().catch(console.error),800));
setTimeout(()=>ensureFixedIds().catch(console.error),1000);
setInterval(()=>ensureFixedIds().catch(()=>{}),6000);
document.addEventListener("click",()=>setTimeout(()=>updateVisibleIds(),200),true);