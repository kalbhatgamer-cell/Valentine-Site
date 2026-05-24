
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

let me=null;
let myProfile={};
let usersById=new Map();
let onlineById=new Map();
let activeChatUid="";
let activeProfileUid="";
let presenceUnsubUsers=null;
let presenceUnsubOnline=null;
let presenceHeartbeat=null;

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uidOf=u=>String(u?.uid||u?.id||u?.__docId||"");
function toDate(v){
  try{
    if(!v)return null;
    if(v.toDate)return v.toDate();
    if(v.seconds)return new Date(v.seconds*1000);
    if(v instanceof Date)return v;
    if(typeof v==='number')return new Date(v);
    return new Date(v);
  }catch(e){return null;}
}
function relTime(d){
  d=toDate(d);
  if(!d || isNaN(d.getTime()))return "Offline";
  const diff=Math.max(0,Date.now()-d.getTime());
  const sec=Math.floor(diff/1000);
  if(sec<45)return "Last seen just now";
  const min=Math.floor(sec/60);
  if(min<60)return "Last seen "+min+" min ago";
  const hr=Math.floor(min/60);
  if(hr<24)return "Last seen "+hr+" hr ago";
  const day=Math.floor(hr/24);
  if(day===1)return "Last seen yesterday";
  if(day<7)return "Last seen "+day+" days ago";
  return "Last seen "+d.toLocaleDateString([], {day:'numeric',month:'short'})+", "+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function getUser(uidOrUser){
  if(!uidOrUser)return null;
  if(typeof uidOrUser==='object')return uidOrUser;
  return usersById.get(String(uidOrUser))||null;
}
function blockedByMe(uid){
  uid=String(uid||"");
  return Array.isArray(myProfile?.blockedUsers) && myProfile.blockedUsers.includes(uid);
}
function blockedMe(uid){
  const u=getUser(uid);
  return !!(me && u && Array.isArray(u.blockedUsers) && u.blockedUsers.includes(me.uid));
}
function presenceText(uidOrUser){
  const u=getUser(uidOrUser);
  const uid=uidOf(u)||String(uidOrUser||"");
  if(!uid)return "Offline";
  if(blockedByMe(uid))return "Blocked";
  if(blockedMe(uid))return "You are blocked";
  if(u && u.hideOnline===true)return "Hidden by privacy";
  const p=onlineById.get(uid)||{};
  if(p.online===true)return "Online";
  return relTime(p.lastSeen || u?.lastSeen || u?.updatedAt);
}
function presenceClass(text){
  text=String(text||"").toLowerCase();
  if(text==='online')return 'online';
  if(text.includes('hidden'))return 'hidden';
  if(text.includes('blocked'))return 'blocked';
  return '';
}
function canTalkTo(uid){
  uid=String(uid||"");
  if(!me || !uid)return false;
  return !blockedByMe(uid) && !blockedMe(uid);
}
async function reloadMyProfile(){
  if(!me)return {};
  try{
    const s=await getDoc(doc(db,'users',me.uid));
    myProfile=s.exists()?{uid:s.id,...s.data()}:{};
    window.currentUserProfile={...(window.currentUserProfile||{}),...myProfile};
  }catch(e){console.warn('Profile reload skipped',e);}
  return myProfile;
}
async function setPresenceNow(online){
  if(!me)return;
  try{
    await setDoc(doc(db,'onlineUsers',me.uid),{
      uid:me.uid,
      email:me.email||'',
      online:!!online,
      lastSeen:serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});
  }catch(e){console.warn('Presence save failed',e);}
}
function startPresence(){
  clearInterval(presenceHeartbeat);
  setPresenceNow(document.visibilityState!=='hidden');
  presenceHeartbeat=setInterval(()=>setPresenceNow(document.visibilityState!=='hidden'),30000);
}
document.addEventListener('visibilitychange',()=>{ if(me) setPresenceNow(document.visibilityState!=='hidden'); });
window.addEventListener('beforeunload',()=>{ if(me) setPresenceNow(false); });

function extractUidFromCard(card){
  if(!card)return '';
  const direct=card.getAttribute('data-user-uid')||card.getAttribute('data-uid')||card.dataset?.uid||'';
  if(direct)return direct;
  const clicks=Array.from(card.querySelectorAll('[onclick]')).map(x=>x.getAttribute('onclick')||'').join(' ')+(card.getAttribute('onclick')||'');
  const m=clicks.match(/(?:viewUserProfile|openUserProfile|openPrivateChat|messageUser|requestCallToUser|startDirectCall|blockUser|unblockUser|sendFriendRequest)\(["']([^"']+)["']/);
  return m?m[1]:'';
}
function addPresenceLine(card,uid){
  if(!card||!uid||uid===me?.uid)return;
  const text=presenceText(uid);
  const holder=card.querySelector('.user-info,.user-details,.call-friend-sub,.friend-info,.chat-info')||card;
  let line=card.querySelector(':scope > .kalb-presence-line')||holder.querySelector(':scope > .kalb-presence-line');
  if(!line){
    line=document.createElement('div');
    line.className='kalb-presence-line';
    holder.appendChild(line);
  }
  const cls=presenceClass(text);
  if(line.dataset.text!==text || line.dataset.cls!==cls){
    line.dataset.text=text;
    line.dataset.cls=cls;
    line.innerHTML=`<span class="kalb-presence-dot ${cls}"></span><span>${esc(text)}</span>`;
  }
  const isBlocked=blockedByMe(uid);
  card.classList.toggle('blocked-user', isBlocked);
  const canTalk=canTalkTo(uid);
  card.querySelectorAll('button').forEach(btn=>{
    const oc=btn.getAttribute('onclick')||'';
    const isMsg=/openPrivateChat|messageUser/.test(oc);
    const isCall=/requestCallToUser|startDirectCall/.test(oc);
    if(isMsg||isCall){
      btn.disabled=!canTalk;
      btn.style.opacity=canTalk?'':'.55';
      btn.title=canTalk?'':(isBlocked?'You blocked this user':'This user blocked you');
    }
  });
}
function applyPresenceLines(){
  document.querySelectorAll('.user-row,.search-user-card,.friend-card,.friend-row-fixed,.profile-polish-list,.call-friend-card,.search-result').forEach(card=>{
    const uid=extractUidFromCard(card);
    if(uid && usersById.has(uid))addPresenceLine(card,uid);
  });
  updateRoomPresence();
  updateProfilePresence();
}
function updateRoomPresence(){
  const uid=activeChatUid||window.__kalbCurrentChatUid||'';
  const sub=document.getElementById('roomSub');
  if(!sub||!uid)return;
  if(!sub.dataset.kalbBase){
    sub.dataset.kalbBase=(sub.textContent||'').replace(/\s•\s(Online|Offline|Last seen.*|Hidden by privacy|Blocked|You are blocked).*$/,'');
  }
  const text=presenceText(uid);
  if(sub.dataset.kalbPresenceText!==text){
    sub.dataset.kalbPresenceText=text;
    sub.innerHTML=`${esc(sub.dataset.kalbBase||'')} • <span class="kalb-presence-line" style="display:inline-flex;margin-top:0!important"><span class="kalb-presence-dot ${presenceClass(text)}"></span><span>${esc(text)}</span></span>`;
  }
  const tools=document.querySelector('#chatRoomPage .chat-tools');
  if(tools && uid){
    let b=document.getElementById('kalbRoomBlockBtn');
    if(!b){
      b=document.createElement('button');
      b.id='kalbRoomBlockBtn';
      b.className='btn small red';
      tools.appendChild(b);
    }
    b.textContent=blockedByMe(uid)?'Unblock':'Block';
    b.onclick=()=>blockedByMe(uid)?window.unblockUser(uid):window.blockUser(uid);
  }
  const sendBtn=document.querySelector('#chatRoomPage .sendbar button');
  const input=document.getElementById('messageInput');
  const noteId='kalbChatBlockNote';
  let note=document.getElementById(noteId);
  if(!canTalkTo(uid)){
    if(sendBtn)sendBtn.disabled=true;
    if(input){input.disabled=true;input.placeholder=blockedByMe(uid)?'You blocked this user':'This user blocked you';}
    if(!note){
      note=document.createElement('div'); note.id=noteId; note.className='kalb-block-note';
      document.querySelector('#chatRoomPage .card:last-child')?.prepend(note);
    }
    note.textContent=blockedByMe(uid)?'You blocked this user. Unblock to send messages or call.':'This user blocked you. Messages and calls are disabled.';
  }else{
    if(sendBtn)sendBtn.disabled=false;
    if(input){input.disabled=false;input.placeholder='Type message...';}
    if(note)note.remove();
  }
}
function updateProfilePresence(uid=activeProfileUid||window.viewingProfileUid||window.__kalbViewingUid||''){
  if(!uid)return;
  const last=document.getElementById('viewProfileLastSeen');
  if(last)last.textContent=presenceText(uid);
  const row=document.querySelector('#viewProfilePage .profile-action-row');
  if(row && uid!==me?.uid){
    let btn=document.getElementById('kalbProfileBlockBtn');
    if(!btn){ btn=document.createElement('button'); btn.id='kalbProfileBlockBtn'; btn.className='btn small red'; row.appendChild(btn); }
    btn.textContent=blockedByMe(uid)?'Unblock':'Block';
    btn.onclick=()=>blockedByMe(uid)?window.unblockUser(uid):window.blockUser(uid);
  }
}

function insertMessageSearchUI(){
  const page=document.getElementById('chatRoomPage');
  if(!page || document.getElementById('kalbMessageSearchInput'))return;
  const card=page.querySelector('.card');
  if(!card)return;
  const wrap=document.createElement('div');
  wrap.className='kalb-chat-search-wrap';
  wrap.innerHTML=`<div class="kalb-chat-search-row"><input id="kalbMessageSearchInput" placeholder="Search messages in this chat..." autocomplete="off"><button class="btn small" id="kalbClearMessageSearchBtn" type="button">Clear</button></div><span id="kalbSearchResultText" class="kalb-search-result-text">Type to search old messages.</span>`;
  card.appendChild(wrap);
  document.getElementById('kalbMessageSearchInput').addEventListener('input',filterMessagesInChat);
  document.getElementById('kalbClearMessageSearchBtn').addEventListener('click',()=>{const i=document.getElementById('kalbMessageSearchInput'); if(i){i.value=''; filterMessagesInChat(); i.focus();}});
}
function filterMessagesInChat(){
  const input=document.getElementById('kalbMessageSearchInput');
  const box=document.getElementById('messagesBox');
  const info=document.getElementById('kalbSearchResultText');
  if(!input||!box)return;
  const q=input.value.trim().toLowerCase();
  let total=0, shown=0;
  box.querySelectorAll('.msg').forEach(msg=>{
    total++;
    msg.classList.remove('kalb-search-hit');
    const ok=!q || (msg.textContent||'').toLowerCase().includes(q);
    msg.classList.toggle('kalb-msg-hidden',!ok);
    if(ok){shown++; if(q)msg.classList.add('kalb-search-hit');}
  });
  if(info)info.textContent=q ? `${shown} of ${total} message${total===1?'':'s'} found` : 'Type to search old messages.';
}
window.kalbSearchMessages=filterMessagesInChat;

async function robustBlock(uid){
  uid=String(uid||'');
  if(!me||!uid)return alert('Login first.');
  if(uid===me.uid)return alert('You cannot block yourself.');
  if(!confirm('Block this user? They cannot message or call you.'))return;
  try{
    await setDoc(doc(db,'users',me.uid),{blockedUsers:arrayUnion(uid),friends:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
    try{await updateDoc(doc(db,'users',uid),{friends:arrayRemove(me.uid),updatedAt:serverTimestamp()});}catch(e){}
    await reloadMyProfile();
    applyPresenceLines();
    try{if(typeof window.renderUsers==='function')window.renderUsers();}catch(e){}
    try{if(typeof window.renderFriendsList==='function')window.renderFriendsList();}catch(e){}
    alert('User blocked.');
  }catch(e){console.error(e);alert('Block failed: '+(e.message||e));}
}
async function robustUnblock(uid){
  uid=String(uid||'');
  if(!me||!uid)return alert('Login first.');
  try{
    await setDoc(doc(db,'users',me.uid),{blockedUsers:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
    await reloadMyProfile();
    applyPresenceLines();
    try{if(typeof window.renderUsers==='function')window.renderUsers();}catch(e){}
    try{if(typeof window.renderFriendsList==='function')window.renderFriendsList();}catch(e){}
    alert('User unblocked.');
  }catch(e){console.error(e);alert('Unblock failed: '+(e.message||e));}
}
window.blockUser=robustBlock;
window.unblockUser=robustUnblock;
window.isBlocked=uid=>blockedByMe(uid);
window.kalbCanTalkTo=canTalkTo;
window.getKalbPresenceText=presenceText;
window.getPrivacyAwareLastSeen=function(u){return presenceText(u);};
window.formatLastSeen=function(u){return presenceText(u);};

function wrapCoreFunctions(){
  if(!window.__kalbPresenceBlockWrappedOpen && typeof window.openPrivateChat==='function'){
    window.__kalbPresenceBlockWrappedOpen=true;
    const old=window.openPrivateChat;
    window.openPrivateChat=function(uid){
      activeChatUid=String(uid||''); window.__kalbCurrentChatUid=activeChatUid;
      if(activeChatUid && !canTalkTo(activeChatUid)){
        return alert(blockedByMe(activeChatUid)?'You blocked this user. Unblock to message.':'This user blocked you. You cannot message.');
      }
      const r=old.apply(this,arguments);
      setTimeout(()=>{insertMessageSearchUI();updateRoomPresence();filterMessagesInChat();},150);
      setTimeout(()=>{updateRoomPresence();},600);
      return r;
    };
  }
  if(!window.__kalbPresenceBlockWrappedSend && typeof window.sendPrivateChat==='function'){
    window.__kalbPresenceBlockWrappedSend=true;
    const old=window.sendPrivateChat;
    window.sendPrivateChat=function(){
      const uid=activeChatUid||window.__kalbCurrentChatUid||'';
      if(uid && !canTalkTo(uid))return alert(blockedByMe(uid)?'You blocked this user. Unblock to send messages.':'This user blocked you. Messages are disabled.');
      return old.apply(this,arguments);
    };
  }
  if(!window.__kalbPresenceBlockWrappedCall && typeof window.requestCallToUser==='function'){
    window.__kalbPresenceBlockWrappedCall=true;
    const old=window.requestCallToUser;
    window.requestCallToUser=function(uid){
      if(uid && !canTalkTo(uid))return alert(blockedByMe(uid)?'You blocked this user. Unblock to call.':'This user blocked you. Calls are disabled.');
      return old.apply(this,arguments);
    };
  }
  if(!window.__kalbPresenceBlockWrappedDirectCall && typeof window.startDirectCall==='function'){
    window.__kalbPresenceBlockWrappedDirectCall=true;
    const old=window.startDirectCall;
    window.startDirectCall=function(uid){
      if(uid && !canTalkTo(uid))return alert(blockedByMe(uid)?'You blocked this user. Unblock to call.':'This user blocked you. Calls are disabled.');
      return old.apply(this,arguments);
    };
  }
  if(!window.__kalbPresenceWrappedProfile && typeof window.viewUserProfile==='function'){
    window.__kalbPresenceWrappedProfile=true;
    const old=window.viewUserProfile;
    window.viewUserProfile=async function(uid){
      activeProfileUid=String(uid||''); window.__kalbViewingUid=activeProfileUid;
      const r=await old.apply(this,arguments);
      setTimeout(()=>updateProfilePresence(activeProfileUid),150);
      setTimeout(()=>updateProfilePresence(activeProfileUid),600);
      return r;
    };
  }
  if(!window.__kalbPresenceWrappedOpenPage && typeof window.openPage==='function'){
    window.__kalbPresenceWrappedOpenPage=true;
    const old=window.openPage;
    window.openPage=function(){
      const r=old.apply(this,arguments);
      setTimeout(()=>{insertMessageSearchUI();applyPresenceLines();filterMessagesInChat();},150);
      return r;
    };
  }
  if(!window.__kalbPresenceWrappedPrivacy && typeof window.savePrivacySetting==='function'){
    window.__kalbPresenceWrappedPrivacy=true;
    const old=window.savePrivacySetting;
    window.savePrivacySetting=async function(){
      const r=await old.apply(this,arguments);
      await reloadMyProfile();
      applyPresenceLines();
      return r;
    };
  }
  if(!window.__kalbPresenceWrappedTogglePrivacy && typeof window.toggleOnlinePrivacy==='function'){
    window.__kalbPresenceWrappedTogglePrivacy=true;
    const old=window.toggleOnlinePrivacy;
    window.toggleOnlinePrivacy=async function(){
      const r=await old.apply(this,arguments);
      await reloadMyProfile();
      applyPresenceLines();
      return r;
    };
  }
}

function initListeners(){
  if(presenceUnsubUsers)presenceUnsubUsers();
  if(presenceUnsubOnline)presenceUnsubOnline();
  presenceUnsubUsers=onSnapshot(collection(db,'users'),snap=>{
    usersById=new Map();
    const arr=[];
    snap.forEach(d=>{const u={uid:d.id,...d.data()}; usersById.set(d.id,u); arr.push(u);});
    window.allUsers=arr;
    if(me && usersById.has(me.uid)){myProfile=usersById.get(me.uid); window.currentUserProfile={...(window.currentUserProfile||{}),...myProfile};}
    applyPresenceLines();
  },e=>console.warn('presence users listener failed',e));
  presenceUnsubOnline=onSnapshot(collection(db,'onlineUsers'),snap=>{
    onlineById=new Map();
    snap.forEach(d=>{const data=d.data()||{}; onlineById.set(data.uid||d.id,data);});
    applyPresenceLines();
  },e=>console.warn('presence listener failed',e));
}

onAuthStateChanged(auth,async user=>{
  me=user||null;
  if(!me){ myProfile={}; usersById=new Map(); onlineById=new Map(); clearInterval(presenceHeartbeat); return; }
  await reloadMyProfile();
  startPresence();
  initListeners();
  setTimeout(()=>{wrapCoreFunctions();insertMessageSearchUI();applyPresenceLines();},500);
  setTimeout(()=>{wrapCoreFunctions();insertMessageSearchUI();applyPresenceLines();},1600);
});

let kalbUiUpdateTimer=null;
function scheduleKalbUiUpdate(runSearch=false){
  clearTimeout(kalbUiUpdateTimer);
  kalbUiUpdateTimer=setTimeout(()=>{
    try{wrapCoreFunctions();}catch(e){}
    try{insertMessageSearchUI();}catch(e){}
    try{applyPresenceLines();}catch(e){}
    if(runSearch)try{filterMessagesInChat();}catch(e){}
  },250);
}
document.addEventListener('DOMContentLoaded',()=>scheduleKalbUiUpdate(false));
window.addEventListener('load',()=>scheduleKalbUiUpdate(false));
// No heavy MutationObserver/click loop: it was causing page unresponsive/loading freeze.
document.addEventListener('click',()=>scheduleKalbUiUpdate(false),false);
setInterval(()=>scheduleKalbUiUpdate(false),15000);
try{window.safeReady&&window.safeReady();}catch(e){}
setTimeout(()=>{try{document.body.classList.add('ready');const l=document.getElementById('loader');if(l)l.style.display='none';}catch(e){}},1800);
