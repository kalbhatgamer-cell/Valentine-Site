
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL="kalbhatgamer@gmail.com";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function baseKalbId(uid,salt=""){
  let h=0,str=String(uid||"")+String(salt||"");
  for(let i=0;i<str.length;i++) h=((h<<5)-h+str.charCodeAt(i))|0;
  return "KLB-"+String(Math.abs(h)).padStart(6,"0").slice(0,6);
}
function uidOf(u){return String(u?.uid||u?.id||u?.userId||u?.docId||u?.__docId||"");}
function kalbIdOf(u){return String(u?.kalbId||u?.profileId||u?.publicId||u?.shortId||baseKalbId(uidOf(u))).toUpperCase();}
function isAdminNow(){
  const u=auth.currentUser||window.currentUser||null;
  const email=String(u?.email||window.currentUserProfile?.email||"").toLowerCase();
  if(email===ADMIN_EMAIL) return true;
  const p=window.currentUserProfile||{};
  return p.role==="admin"||p.admin===true||p.isAdmin===true;
}
async function getUsersFresh(){
  const snap=await getDocs(collection(db,"users"));
  const users=[];
  snap.forEach(d=>users.push({__docId:d.id,uid:d.id,id:d.id,...d.data()}));
  window.allUsers=users;
  return users;
}
async function ensurePermanentIds(){
  const users=await getUsersFresh();
  const used=new Set(users.map(u=>String(u.kalbId||"").toUpperCase()).filter(Boolean));
  for(const u of users){
    const uid=uidOf(u);
    if(!uid) continue;
    if(u.kalbId){u.kalbId=String(u.kalbId).toUpperCase();continue;}
    let kid=baseKalbId(uid), salt=1;
    while(used.has(kid)){kid=baseKalbId(uid,"-"+(salt++));}
    used.add(kid);
    u.kalbId=kid;
    try{await updateDoc(doc(db,"users",uid),{kalbId:kid});}catch(e){console.warn("ID save failed",uid,e);}
  }
  buildBadgePicker(users);
  return users;
}
function buildBadgePicker(users=window.allUsers||[]){
  const input=document.getElementById("badgeUserIdInput");
  if(!input) return;
  input.placeholder="Kalb ID / UID / email";
  let picker=document.getElementById("badgeUserPicker");
  if(!picker){
    picker=document.createElement("select");
    picker.id="badgeUserPicker";
    input.insertAdjacentElement("afterend",picker);
    picker.addEventListener("change",()=>{if(picker.value) input.value=picker.value;});
  }
  picker.innerHTML='<option value="">Select user by Kalb ID</option>'+users.filter(u=>uidOf(u)).map(u=>{
    const name=u.name||u.displayName||u.username||(u.email?String(u.email).split("@")[0]:"User");
    return `<option value="${esc(kalbIdOf(u))}">${esc(name)} — ${esc(kalbIdOf(u))}</option>`;
  }).join("");
}
async function resolveTarget(){
  const input=document.getElementById("badgeUserIdInput");
  const picker=document.getElementById("badgeUserPicker");
  const raw=String(input?.value||picker?.value||"").trim();
  if(!raw) return "";
  const v=raw.toLowerCase();
  const users=await ensurePermanentIds();
  const found=users.find(u=>[uidOf(u),kalbIdOf(u),u.email,u.username,u.name,u.displayName].filter(Boolean).some(x=>String(x).trim().toLowerCase()===v));
  return found?uidOf(found):raw;
}
async function changeBadge(add){
  if(!isAdminNow()) return alert("Admin only.");
  const uid=await resolveTarget();
  const badge=document.getElementById("badgeTypeInput")?.value;
  if(!uid||!badge) return alert("Select a user and badge.");
  const users=window.allUsers||[];
  const user=users.find(u=>uidOf(u)===uid)||{};
  let badges=Array.isArray(user.badges)?[...user.badges]:[];
  if(add){if(!badges.includes(badge)) badges.push(badge);} else {badges=badges.filter(x=>x!==badge);}
  const data={badges};
  if(badge==="verified") data.verified=add;
  if(badge==="creator") data.creator=add;
  if(badge==="moderator") data.moderator=add;
  if(badge==="banned") data.banned=add;
  await updateDoc(doc(db,"users",uid),data);
  const local=(window.allUsers||[]).find(u=>uidOf(u)===uid); if(local) Object.assign(local,data);
  try{if(typeof window.applyProfileBadgesFinal==="function") window.applyProfileBadgesFinal();}catch(e){}
  alert(add?"Badge added.":"Badge removed.");
}
window.isKalbAdminFixed=isAdminNow;
window.adminAddBadgeFinal=()=>changeBadge(true).catch(e=>{console.error(e);alert("Badge add failed: "+(e.message||e));});
window.adminRemoveBadgeFinal=()=>changeBadge(false).catch(e=>{console.error(e);alert("Badge remove failed: "+(e.message||e));});
onAuthStateChanged(auth,()=>setTimeout(()=>ensurePermanentIds().catch(console.error),700));
setTimeout(()=>ensurePermanentIds().catch(console.error),1200);
setInterval(()=>ensurePermanentIds().catch(()=>{}),10000);
