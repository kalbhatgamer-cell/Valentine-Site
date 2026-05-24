
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL='kalbhatgamer@gmail.com';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isAdmin=()=>!!(auth.currentUser&&String(auth.currentUser.email||'').toLowerCase()===ADMIN_EMAIL);
function fixedNotice(id,msg,bad=false){const box=$(id);if(box)box.innerHTML=`<div class="kalb-fixed-status ${bad?'err':''}">${esc(msg)}</div>`;}
function tsSeconds(t){return (t&&t.seconds)||0;}
function timeText(t){try{return t&&t.seconds?new Date(t.seconds*1000).toLocaleString():'';}catch(e){return '';}}
function safeName(u,f='User'){return u?.name||u?.displayName||u?.username||String(u?.email||f).split('@')[0]||f;}
function firstChar(v){const s=String(v||'U').trim();return Array.from(s)[0]?.toUpperCase()||'U';}
function visible(el){if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
function getVisibleInputByPlaceholder(text){const needle=String(text).toLowerCase();return Array.from(document.querySelectorAll('input,textarea')).find(el=>visible(el)&&String(el.placeholder||'').toLowerCase().includes(needle));}

/* Maintenance: save/load using multiple safe paths + local fallback, so the button always works on your admin account. */
const maintenancePaths=[['appConfig','maintenance'],['settings','maintenance'],['publicConfig','maintenance'],['adminConfig','maintenance']];
let fixedMaintenance={enabled:false,message:'We are improving Kalb Message. Please come back soon.'};
function renderFixedMaintenance(){
  const enabled=fixedMaintenance.enabled===true;
  const overlay=$('kalbMaintenanceOverlay');
  if(overlay) overlay.style.display=(enabled&&!isAdmin())?'flex':'none';
  if($('kalbMaintenanceOverlayMessage')) $('kalbMaintenanceOverlayMessage').innerText=fixedMaintenance.message||'We are improving Kalb Message. Please come back soon.';
  if($('kalbAdminMaintenanceState')) $('kalbAdminMaintenanceState').value=enabled?'on':'off';
  if($('kalbAdminMaintenanceMessage')) $('kalbAdminMaintenanceMessage').value=fixedMaintenance.message||'';
}
async function readMaintenanceFromAny(){
  for(const [c,d] of maintenancePaths){
    try{const s=await getDoc(doc(db,c,d)); if(s.exists()){fixedMaintenance={...fixedMaintenance,...s.data()}; localStorage.setItem('kalbMaintenanceBackup',JSON.stringify(fixedMaintenance)); renderFixedMaintenance(); return {ok:true,path:`${c}/${d}`};}}catch(e){}
  }
  try{const local=JSON.parse(localStorage.getItem('kalbMaintenanceBackup')||'null'); if(local){fixedMaintenance={...fixedMaintenance,...local}; renderFixedMaintenance(); return {ok:true,path:'local backup'};}}catch(e){}
  renderFixedMaintenance(); return {ok:false,path:''};
}
window.kalbAdminLoadMaintenance=async function(){const r=await readMaintenanceFromAny(); fixedNotice('kalbAdminAppControlStatus',r.ok?`Maintenance status loaded from ${r.path}.`:'Maintenance status loaded.');};
window.kalbAdminSaveMaintenance=async function(){
  if(!isAdmin()) return alert('Admin only. Login with kalbhatgamer@gmail.com to use this control.');
  const stateEl=$('kalbAdminMaintenanceState');
  const msgEl=$('kalbAdminMaintenanceMessage');
  const enabled=(stateEl?.value==='on');
  const message=(msgEl?.value||'Kalb Message is under maintenance. Please come back soon.').trim();
  const payload={enabled,message,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.email||''};
  let saved=[]; let errors=[];
  for(const [c,d] of maintenancePaths){
    try{await setDoc(doc(db,c,d),payload,{merge:true}); saved.push(`${c}/${d}`);}catch(e){errors.push(`${c}/${d}: ${e.code||e.message||'failed'}`);}
  }
  fixedMaintenance={enabled,message};
  localStorage.setItem('kalbMaintenanceBackup',JSON.stringify({enabled,message,updatedBy:auth.currentUser.email||'',updatedLocal:Date.now()}));
  renderFixedMaintenance();
  if(saved.length) fixedNotice('kalbAdminAppControlStatus',`Maintenance ${enabled?'ON':'OFF'} saved successfully.`);
  else fixedNotice('kalbAdminAppControlStatus','Saved on this device. To make it global, allow admin write/read for appConfig/maintenance in Firebase rules.',true);
};
function listenMaintenanceFixed(){
  maintenancePaths.forEach(([c,d])=>{try{onSnapshot(doc(db,c,d),s=>{if(s.exists()){fixedMaintenance={...fixedMaintenance,...s.data()}; localStorage.setItem('kalbMaintenanceBackup',JSON.stringify(fixedMaintenance)); renderFixedMaintenance();}},()=>{});}catch(e){}});
  setTimeout(readMaintenanceFromAny,900);
}

/* Chats: show active/archived using members OR users fields, and don't hide real chats just because old docs have a different field name. */
let fixedUsers=[];let fixedChats=[];let chatUnsubs=[];
function chatMembers(c){
  let arr=[];
  if(Array.isArray(c.members)) arr=c.members.slice();
  else if(Array.isArray(c.users)) arr=c.users.slice();
  else if(Array.isArray(c.participants)) arr=c.participants.slice();
  else if(c.uid1&&c.uid2) arr=[c.uid1,c.uid2];
  else if(c.user1&&c.user2) arr=[c.user1,c.user2];
  if(auth.currentUser&&(!arr.length||!arr.includes(auth.currentUser.uid))){
    const parts=String(c.id||'').split(/[_:|\-]/).filter(Boolean);
    if(parts.includes(auth.currentUser.uid)) arr=Array.from(new Set([...arr,...parts]));
  }
  return arr;
}
function userByUid(uid){return fixedUsers.find(u=>u.uid===uid||u.id===uid)||{};}
function archivedList(){try{return JSON.parse(localStorage.getItem('kalbArchivedChats_'+auth.currentUser.uid)||'[]')}catch(e){return[]}}
function setArchivedList(v){try{localStorage.setItem('kalbArchivedChats_'+auth.currentUser.uid,JSON.stringify(v))}catch(e){}}
function deletedMap(){try{return JSON.parse(localStorage.getItem('kalbDeletedChatMap_'+auth.currentUser.uid)||'{}')}catch(e){return{}}}
function isDeleted(c){const m=deletedMap();const d=m[c.id];if(!d)return false;const u=((tsSeconds(c.lastMessageAt)||tsSeconds(c.updatedAt)||tsSeconds(c.createdAt))*1000);return !u||u<=d;}
function mergeChats(arr){const map=new Map(fixedChats.map(c=>[c.id,c])); arr.forEach(c=>{if(c&&c.id)map.set(c.id,{...(map.get(c.id)||{}),...c});}); fixedChats=Array.from(map.values());}
window.renderChatListCache=function(){window.kalbRenderFixedChats();};
window.kalbRenderFixedChats=function(){
  const box=$('chatList'); if(!box||!auth.currentUser)return;
  const uid=auth.currentUser.uid;
  const search=String($('chatSearchInput')?.value||'').toLowerCase().trim();
  const archived=archivedList();
  const filter=String(window.chatFilter||'all').toLowerCase();
  const wantArchived=(filter==='archived'||window.__kalbShowArchivedOnly===true);
  let list=fixedChats.filter(c=>chatMembers(c).includes(uid)&&!isDeleted(c));
  list=list.filter(c=>{
    const isA=archived.includes(c.id)||c.archivedBy?.includes?.(uid);
    if(wantArchived) return isA;
    if(filter==='pinned') return Array.isArray(c.pinnedBy)&&c.pinnedBy.includes(uid);
    return !isA;
  });
  list=list.filter(c=>{
    const mem=chatMembers(c); const other=mem.find(x=>x!==uid)||c.otherUid||''; const u=userByUid(other);
    const name=((c.memberNames&&c.memberNames[other])||c.otherName||safeName(u,'User')).toLowerCase();
    return !search||name.includes(search)||String(c.lastMessage||c.latestMessage||'').toLowerCase().includes(search);
  });
  list.sort((a,b)=>(tsSeconds(b.lastMessageAt)||tsSeconds(b.updatedAt)||tsSeconds(b.createdAt)||0)-(tsSeconds(a.lastMessageAt)||tsSeconds(a.updatedAt)||tsSeconds(a.createdAt)||0));
  if(!list.length){box.innerHTML=`<div class="card empty">${wantArchived?'No archived chats.':'No active chats yet.'}<div class="kalb-chat-empty-hint">Open a user profile or use Find Users to start a chat.</div></div>`;return;}
  box.innerHTML=list.map(c=>{
    const mem=chatMembers(c); const other=mem.find(x=>x!==uid)||c.otherUid||''; const u=userByUid(other); const name=(c.memberNames&&c.memberNames[other])||c.otherName||safeName(u,'User');
    const isA=archived.includes(c.id)||c.archivedBy?.includes?.(uid); const pinned=Array.isArray(c.pinnedBy)&&c.pinnedBy.includes(uid); const last=c.lastMessage||c.latestMessage||'Tap Open to continue chat.';
    return `<div class="card user-row" data-fixed-chat-id="${esc(c.id)}"><div class="avatar">${esc(u.avatarEmoji||firstChar(name))}</div><div class="user-info"><h3>${esc(name)} ${isA?'<span class="archived-label">Archived</span>':''} ${pinned?'<span class="archived-label">Pinned</span>':''}</h3><p class="muted">${esc(last)}</p><p class="muted">${esc(timeText(c.lastMessageAt||c.updatedAt||c.createdAt))}</p></div><div class="actions"><button class="btn small" onclick="kalbOpenChatFromList('${esc(c.id)}','${esc(other)}')">Open</button>${isA?`<button class="btn small" onclick="kalbFixedUnarchiveChat('${esc(c.id)}')">Unarchive</button>`:`<button class="btn small" onclick="kalbFixedArchiveChat('${esc(c.id)}')">Archive</button>`}<button class="btn small red" onclick="deleteChatLocal('${esc(c.id)}')">Delete</button></div></div>`;
  }).join('');
};
window.kalbFixedArchiveChat=function(id){const a=archivedList();if(!a.includes(id))a.push(id);setArchivedList(a);window.kalbRenderFixedChats();};
window.kalbFixedUnarchiveChat=function(id){setArchivedList(archivedList().filter(x=>x!==id));window.kalbRenderFixedChats();};
window.archiveChat=window.kalbFixedArchiveChat;
window.unarchiveChat=window.kalbFixedUnarchiveChat;
window.showActiveChats=function(){window.__kalbShowArchivedOnly=false;window.chatFilter='all';setTimeout(window.kalbRenderFixedChats,20);setTimeout(window.kalbRenderFixedChats,400);};
window.showArchivedChats=function(){window.__kalbShowArchivedOnly=true;window.chatFilter='archived';setTimeout(window.kalbRenderFixedChats,20);setTimeout(window.kalbRenderFixedChats,400);};
function startFixedChats(user){
  chatUnsubs.forEach(fn=>{try{fn()}catch(e){}}); chatUnsubs=[]; fixedChats=[];
  try{chatUnsubs.push(onSnapshot(collection(db,'users'),snap=>{fixedUsers=[];snap.forEach(d=>fixedUsers.push({uid:d.id,...d.data()}));window.kalbRenderFixedChats();},()=>{}));}catch(e){}
  const addSnap=snap=>{const arr=[];snap.forEach(d=>arr.push({id:d.id,...d.data()}));mergeChats(arr);window.kalbRenderFixedChats();};
  try{chatUnsubs.push(onSnapshot(query(collection(db,'chats'),where('members','array-contains',user.uid)),addSnap,()=>{}));}catch(e){}
  try{chatUnsubs.push(onSnapshot(query(collection(db,'chats'),where('users','array-contains',user.uid)),addSnap,()=>{}));}catch(e){}
  setTimeout(async()=>{try{const snap=await getDocs(collection(db,'chats')); const arr=[];snap.forEach(d=>{const c={id:d.id,...d.data()}; if(chatMembers(c).includes(user.uid)) arr.push(c);}); mergeChats(arr); window.kalbRenderFixedChats();}catch(e){}},1000);
}

/* Groups: robust picker + create using the real visible group-name input. */
let fixedGroupUsers=[];let fixedGroups=[];let groupUnsubs=[];
function groupMembers(g){return Array.isArray(g.members)?g.members:(Array.isArray(g.users)?g.users:[]);}
function mergeGroups(arr){const m=new Map(fixedGroups.map(g=>[g.id,g]));arr.forEach(g=>{if(g?.id)m.set(g.id,{...(m.get(g.id)||{}),...g});});fixedGroups=Array.from(m.values());}
window.renderGroupMemberPicker=async function(){
  const box=$('groupMembersPick'); if(!box||!auth.currentUser)return;
  if(!fixedGroupUsers.length){try{const s=await getDocs(collection(db,'users'));fixedGroupUsers=[];s.forEach(d=>fixedGroupUsers.push({uid:d.id,...d.data()}));}catch(e){}}
  const list=fixedGroupUsers.filter(u=>u.uid!==auth.currentUser.uid);
  box.innerHTML=list.length?list.map(u=>`<label class="group-member"><input type="checkbox" value="${esc(u.uid)}"><span>${esc(safeName(u,'User'))} (@${esc(u.username||String(u.email||'user').split('@')[0])})</span></label>`).join(''):'<p class="muted">No other users found. You can still create a group with only yourself.</p>';
};
window.renderGroups=function(){
  const box=$('groupsList'); if(!box||!auth.currentUser)return;
  const uid=auth.currentUser.uid;
  let list=fixedGroups.filter(g=>groupMembers(g).includes(uid));
  list.sort((a,b)=>(tsSeconds(b.updatedAt)||tsSeconds(b.createdAt)||0)-(tsSeconds(a.updatedAt)||tsSeconds(a.createdAt)||0));
  box.innerHTML=list.length?list.map(g=>`<div class="card" onclick="openGroupRoom('${esc(g.id)}')"><div class="user-row"><div class="avatar">👥</div><div class="user-info"><h3>${esc(g.name||'Group')}</h3><p>${groupMembers(g).length} members • ${esc(g.lastMessage||'Open group chat')}</p></div></div></div>`).join(''):'<div class="card empty">No groups yet. Create your first group.</div>';
};
window.createGroup=async function(){
  if(!auth.currentUser)return alert('Login first.');
  const nameEl=$('groupNameInput')||getVisibleInputByPlaceholder('group name');
  const descEl=$('groupDescInput')||getVisibleInputByPlaceholder('group description');
  const statusId='groupCreateStatus';
  const name=String(nameEl?.value||'').trim();
  const desc=String(descEl?.value||'').trim();
  if(!name){fixedNotice(statusId,'Enter group name.',true); nameEl?.focus(); return;}
  const pickBox=$('groupMembersPick');
  const picked=pickBox?Array.from(pickBox.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value):[];
  const members=Array.from(new Set([auth.currentUser.uid,...picked]));
  let me={}; try{const ms=await getDoc(doc(db,'users',auth.currentUser.uid)); if(ms.exists())me=ms.data();}catch(e){}
  try{
    const ref=await addDoc(collection(db,'groups'),{name,desc,description:desc,adminUid:auth.currentUser.uid,adminName:safeName(me,auth.currentUser.displayName||'User'),members,users:members,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),lastMessage:''});
    if(nameEl)nameEl.value=''; if(descEl)descEl.value=''; fixedNotice(statusId,'Group created.'); mergeGroups([{id:ref.id,name,desc,description:desc,adminUid:auth.currentUser.uid,adminName:safeName(me,'User'),members,users:members,lastMessage:''}]); window.renderGroups(); setTimeout(()=>{try{window.openGroupRoom(ref.id)}catch(e){}},250);
  }catch(e){console.error(e);fixedNotice(statusId,e.message||'Group create failed. Check Firebase rules.',true);}
};
function startFixedGroups(user){
  groupUnsubs.forEach(fn=>{try{fn()}catch(e){}}); groupUnsubs=[]; fixedGroups=[];
  try{groupUnsubs.push(onSnapshot(collection(db,'users'),snap=>{fixedGroupUsers=[];snap.forEach(d=>fixedGroupUsers.push({uid:d.id,...d.data()}));window.renderGroupMemberPicker();},()=>{}));}catch(e){}
  const addSnap=snap=>{const arr=[];snap.forEach(d=>arr.push({id:d.id,...d.data()}));mergeGroups(arr);window.renderGroups();};
  try{groupUnsubs.push(onSnapshot(query(collection(db,'groups'),where('members','array-contains',user.uid)),addSnap,()=>{}));}catch(e){}
  try{groupUnsubs.push(onSnapshot(query(collection(db,'groups'),where('users','array-contains',user.uid)),addSnap,()=>{}));}catch(e){}
  setTimeout(async()=>{try{const s=await getDocs(collection(db,'groups'));const arr=[];s.forEach(d=>{const g={id:d.id,...d.data()};if(groupMembers(g).includes(user.uid))arr.push(g);});mergeGroups(arr);window.renderGroups();}catch(e){}},1000);
}

function wrapOpenPageFixed(){
  if(window.openPage&&!window.openPage.__maintenanceChatGroupFixed){
    const old=window.openPage;
    window.openPage=function(id,nav){const r=old.apply(this,arguments); setTimeout(()=>{if(id==='chatsPage')window.kalbRenderFixedChats(); if(id==='groupsPage')window.renderGroups(); if(id==='createGroupPage')window.renderGroupMemberPicker(); if(id==='adminPage'||id==='settingsPage')renderFixedMaintenance();},250); setTimeout(()=>{if(id==='chatsPage')window.kalbRenderFixedChats(); if(id==='groupsPage')window.renderGroups(); if(id==='createGroupPage')window.renderGroupMemberPicker();},900); return r;};
    window.openPage.__maintenanceChatGroupFixed=true;
  }
}
function bootFixed(user){wrapOpenPageFixed();listenMaintenanceFixed();if(user){startFixedChats(user);startFixedGroups(user);}setTimeout(()=>{renderFixedMaintenance();window.kalbRenderFixedChats();window.renderGroups();window.renderGroupMemberPicker();},1200);}
onAuthStateChanged(auth,u=>bootFixed(u));
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>bootFixed(auth.currentUser),900));
window.addEventListener('load',()=>setTimeout(()=>bootFixed(auth.currentUser),1300));
setInterval(()=>{const active=document.querySelector('.page.active'); if(active&&active.id==='chatsPage')window.kalbRenderFixedChats();},3500);
