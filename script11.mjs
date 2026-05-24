
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const authBadge=getAuth(app);
const dbBadge=getFirestore(app);
function makeKalbId(uid){let h=0,str=String(uid||Math.random());for(let i=0;i<str.length;i++)h=((h<<5)-h+str.charCodeAt(i))|0;return 'KLB-'+String(Math.abs(h)).padStart(6,'0').slice(0,6);}
function uidOf(u){return String(u?.uid||u?.id||u?.userId||u?.docId||'');}
function kalbIdOf(u){return String(u?.kalbId||u?.profileId||u?.publicId||u?.shortId||makeKalbId(uidOf(u))).toUpperCase();}
function isAdminOk(){
  try{ if(typeof window.isAdminFinal==='function') return !!window.isAdminFinal(); }catch(e){}
  try{ if(typeof window.isAppAdmin==='function') return !!window.isAppAdmin(); }catch(e){}
  const p=window.currentUserProfile||{};
  return p.role==='admin'||p.admin===true||p.isAdmin===true;
}
async function readUsers(){
  const local=Array.isArray(window.allUsers)?window.allUsers:[];
  if(local.length) return local;
  const snap=await getDocs(collection(dbBadge,'users'));
  const users=[]; snap.forEach(d=>users.push({uid:d.id,id:d.id,...d.data()}));
  window.allUsers=users; return users;
}
async function resolveTarget(){
  const input=document.getElementById('badgeUserIdInput');
  const picker=document.getElementById('badgeUserPicker');
  const raw=String((picker&&picker.value)||input?.value||'').trim();
  if(!raw) return '';
  const v=raw.toLowerCase();
  const users=await readUsers();
  const found=users.find(u=>[uidOf(u),kalbIdOf(u),u.email,u.username,u.name,u.displayName].filter(Boolean).some(x=>String(x).trim().toLowerCase()===v));
  return found?uidOf(found):raw;
}
async function changeBadge(add){
  if(!isAdminOk()) return alert('Admin only.');
  const uid=await resolveTarget();
  const badge=document.getElementById('badgeTypeInput')?.value;
  if(!uid||!badge) return alert('Select a user and select a badge.');
  const users=await readUsers();
  const user=users.find(u=>uidOf(u)===uid)||{};
  let badges=Array.isArray(user.badges)?[...user.badges]:[];
  if(add){ if(!badges.includes(badge)) badges.push(badge); }
  else{ badges=badges.filter(x=>x!==badge); }
  const data={badges};
  if(badge==='verified')data.verified=add;
  if(badge==='creator')data.creator=add;
  if(badge==='moderator')data.moderator=add;
  if(badge==='banned')data.banned=add;
  await updateDoc(doc(dbBadge,'users',uid),data);
  const local=Array.isArray(window.allUsers)?window.allUsers:[];
  const lu=local.find(u=>uidOf(u)===uid); if(lu) Object.assign(lu,data);
  if(typeof window.applyProfileBadgesFinal==='function') window.applyProfileBadgesFinal();
  alert(add?'Badge added.':'Badge removed.');
}
window.adminAddBadgeFinal=()=>changeBadge(true).catch(e=>{console.error(e);alert('Badge add failed: '+(e.message||e));});
window.adminRemoveBadgeFinal=()=>changeBadge(false).catch(e=>{console.error(e);alert('Badge remove failed: '+(e.message||e));});
