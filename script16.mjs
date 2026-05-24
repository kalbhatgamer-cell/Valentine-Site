
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
let myUser=null;
let myProfileCache={};

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const jsEsc=v=>String(v??"").replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
const arr=v=>Array.isArray(v)?v:[];
function uidOf(u){return String(u?.uid||u?.id||u?.__docId||"");}
function nameOf(u){return u?.displayName||u?.name||u?.fullName||u?.username||u?.email||'User';}
function subOf(u,uid){return [u?.username?('@'+String(u.username).replace(/^@/,'')):'',u?.email||'',uid?('ID: '+uid):''].filter(Boolean).join(' • ');}
function avatarOf(u){return esc((u?.avatarEmoji||nameOf(u)||'U').trim().charAt(0).toUpperCase()||'U');}
async function getMe(){return auth.currentUser||myUser;}
async function getUserDoc(uid){
  uid=String(uid||'');
  if(!uid)return null;
  try{const s=await getDoc(doc(db,'users',uid)); return s.exists()?{uid:s.id,...s.data()}:{uid};}catch(e){return {uid};}
}
async function loadMyProfile(){
  const me=await getMe();
  if(!me){myProfileCache={};return {};}
  const p=await getUserDoc(me.uid)||{uid:me.uid};
  myProfileCache=p;
  window.currentUserProfile={...(window.currentUserProfile||{}),...p};
  return p;
}
function blockedSetFromProfile(p=myProfileCache){return new Set(arr(p?.blockedUsers).map(String));}
function isBlockedLocal(uid){return blockedSetFromProfile().has(String(uid||''));}

function ensureBlockedCard(){
  let card=document.getElementById('kalbBlockedUsersCard');
  if(card)return card;
  const html=`<div class="card" id="kalbBlockedUsersCard">
    <h3>Blocked Users</h3>
    <p class="muted">Users you blocked will show here. Tap Unblock to allow messages and calls again.</p>
    <button class="btn small" type="button" onclick="kalbRenderBlockedUsers()">Refresh Blocked Users</button>
    <div id="kalbBlockedUsersBox"><div class="kalb-blocked-empty">Loading blocked users...</div></div>
  </div>`;
  const settings=document.getElementById('settingsPage');
  const privacy=document.getElementById('privacyPage');
  if(settings){
    const wrap=document.createElement('div'); wrap.innerHTML=html; card=wrap.firstElementChild;
    const second=settings.querySelector('.card:nth-of-type(2)')||settings.querySelector('.card');
    if(second && second.nextSibling)settings.insertBefore(card,second.nextSibling); else settings.appendChild(card);
  }else if(privacy){
    const wrap=document.createElement('div'); wrap.innerHTML=html; card=wrap.firstElementChild; privacy.appendChild(card);
  }
  return card;
}

function updateChatBlockState(blocked){
  const uid=String(window.__kalbCurrentChatUid||'');
  if(!uid)return;
  const input=document.getElementById('messageInput');
  const sendBtn=document.querySelector('#chatRoomPage .sendbar button');
  if(input){input.disabled=!!blocked; input.placeholder=blocked?'You blocked this user':'Type message...';}
  if(sendBtn)sendBtn.disabled=!!blocked;
  let note=document.getElementById('kalbChatBlockNote');
  if(blocked){
    if(!note){note=document.createElement('div'); note.id='kalbChatBlockNote'; note.className='kalb-block-note'; document.querySelector('#chatRoomPage .card:last-child')?.prepend(note);}
    if(note)note.textContent='You blocked this user. Unblock to send messages or call.';
  }else if(note){note.remove();}
}

function refreshBlockButtons(){
  const blocked=blockedSetFromProfile();
  document.querySelectorAll('button[onclick]').forEach(btn=>{
    const oc=btn.getAttribute('onclick')||'';
    const m=oc.match(/(?:blockUser|unblockUser)\(["']([^"']+)["']\)/);
    if(!m)return;
    const uid=m[1];
    const nowBlocked=blocked.has(uid);
    if(nowBlocked){
      btn.textContent='Unblock';
      btn.classList.remove('red');
      btn.setAttribute('onclick',`unblockUser('${jsEsc(uid)}')`);
      btn.disabled=false;
      btn.style.opacity='';
      btn.title='Unblock this user';
    }else{
      const txt=(btn.textContent||'').trim().toLowerCase();
      if(txt==='unblock' || /unblockUser/.test(oc)){
        btn.textContent='Block';
        btn.classList.add('red');
        btn.setAttribute('onclick',`blockUser('${jsEsc(uid)}')`);
        btn.disabled=false;
        btn.style.opacity='';
        btn.title='Block this user';
      }
    }
  });
  const roomUid=String(window.__kalbCurrentChatUid||'');
  if(roomUid){
    const b=document.getElementById('kalbRoomBlockBtn');
    const isB=blocked.has(roomUid);
    if(b){b.textContent=isB?'Unblock':'Block'; b.classList.toggle('red',!isB); b.onclick=()=>isB?window.unblockUser(roomUid):window.blockUser(roomUid);}
    updateChatBlockState(isB);
  }
  const pUid=String(window.__kalbViewingUid||window.viewingProfileUid||'');
  if(pUid){
    const pb=document.getElementById('kalbProfileBlockBtn');
    const isB=blocked.has(pUid);
    if(pb){pb.textContent=isB?'Unblock':'Block'; pb.classList.toggle('red',!isB); pb.onclick=()=>isB?window.unblockUser(pUid):window.blockUser(pUid);}
  }
}

window.kalbRenderBlockedUsers=async function(){
  const card=ensureBlockedCard();
  const box=document.getElementById('kalbBlockedUsersBox');
  if(!box)return;
  const me=await getMe();
  if(!me){box.innerHTML='<div class="kalb-blocked-empty">Please login first.</div>';return;}
  box.innerHTML='<div class="kalb-blocked-empty">Loading blocked users...</div>';
  const p=await loadMyProfile();
  const ids=[...blockedSetFromProfile(p)].filter(x=>x && x!==me.uid);
  refreshBlockButtons();
  if(!ids.length){box.innerHTML='<div class="kalb-blocked-empty">No blocked users.</div>';return;}
  const rows=[];
  for(const uid of ids){
    const u=await getUserDoc(uid)||{uid};
    rows.push(`<div class="kalb-blocked-user-row" data-user-uid="${esc(uid)}">
      <div class="avatar">${avatarOf(u)}</div>
      <div><h3>${esc(nameOf(u))}</h3><p>${esc(subOf(u,uid))}</p></div>
      <div class="kalb-blocked-actions">
        <button class="btn small" type="button" onclick="openUserProfile('${jsEsc(uid)}')">Profile</button>
        <button class="btn small green" type="button" onclick="unblockUser('${jsEsc(uid)}')">Unblock</button>
      </div>
    </div>`);
  }
  box.innerHTML=rows.join('');
};

async function hardBlock(uid){
  uid=String(uid||'');
  const me=await getMe();
  if(!me)return alert('Login first.');
  if(!uid || uid===me.uid)return alert('You cannot block yourself.');
  if(!confirm('Block this user? They cannot message or call you.'))return;
  try{
    await setDoc(doc(db,'users',me.uid),{blockedUsers:arrayUnion(uid),friends:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
    try{await setDoc(doc(db,'users',uid),{friends:arrayRemove(me.uid),updatedAt:serverTimestamp()},{merge:true});}catch(e){}
    await loadMyProfile();
    refreshBlockButtons();
    await window.kalbRenderBlockedUsers();
    setTimeout(()=>{try{window.renderUsers&&window.renderUsers();}catch(e){} try{window.renderFriendsList&&window.renderFriendsList();}catch(e){} setTimeout(refreshBlockButtons,400);},100);
    alert('User blocked.');
  }catch(e){console.error(e);alert('Block failed: '+(e.message||e));}
}
async function hardUnblock(uid){
  uid=String(uid||'');
  const me=await getMe();
  if(!me)return alert('Login first.');
  if(!uid)return alert('User missing.');
  try{
    await setDoc(doc(db,'users',me.uid),{blockedUsers:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
    await loadMyProfile();
    refreshBlockButtons();
    await window.kalbRenderBlockedUsers();
    setTimeout(()=>{try{window.renderUsers&&window.renderUsers();}catch(e){} try{window.renderFriendsList&&window.renderFriendsList();}catch(e){} setTimeout(refreshBlockButtons,400);},100);
    alert('User unblocked.');
  }catch(e){console.error(e);alert('Unblock failed: '+(e.message||e));}
}

function patchFunctions(){
  window.blockUser=hardBlock;
  window.unblockUser=hardUnblock;
  window.isBlocked=uid=>isBlockedLocal(uid);
  ['renderUsers','renderFriendsList','renderFriendRequests','refreshSearchPage'].forEach(name=>{
    const fn=window[name];
    if(typeof fn==='function' && !fn.__kalbUnblockRefresh){
      const wrapped=function(){
        const out=fn.apply(this,arguments);
        Promise.resolve(out).finally(()=>setTimeout(async()=>{await loadMyProfile(); refreshBlockButtons(); window.kalbRenderBlockedUsers();},350));
        return out;
      };
      wrapped.__kalbUnblockRefresh=true;
      window[name]=wrapped;
    }
  });
  if(typeof window.openPage==='function' && !window.openPage.__kalbUnblockRefresh){
    const old=window.openPage;
    const wrapped=function(page){
      const out=old.apply(this,arguments);
      setTimeout(async()=>{ensureBlockedCard(); await loadMyProfile(); refreshBlockButtons(); if(page==='settingsPage'||page==='privacyPage')window.kalbRenderBlockedUsers();},250);
      return out;
    };
    wrapped.__kalbUnblockRefresh=true;
    window.openPage=wrapped;
  }
}

onAuthStateChanged(auth,async user=>{
  myUser=user||null;
  ensureBlockedCard();
  patchFunctions();
  if(myUser){await loadMyProfile(); await window.kalbRenderBlockedUsers(); refreshBlockButtons();}
});

document.addEventListener('DOMContentLoaded',()=>{ensureBlockedCard(); patchFunctions(); setTimeout(()=>{window.kalbRenderBlockedUsers(); refreshBlockButtons();},900);});
window.addEventListener('load',()=>{ensureBlockedCard(); patchFunctions(); setTimeout(()=>{window.kalbRenderBlockedUsers(); refreshBlockButtons();},1200);});
document.addEventListener('click',()=>setTimeout(()=>{patchFunctions(); refreshBlockButtons();},120),false);
setTimeout(()=>{patchFunctions(); window.kalbRenderBlockedUsers(); refreshBlockButtons();},1800);


/* ACCOUNT SWITCHER OPENPAGE REFRESH */
try{
  const kalbOldOpenPageForAccountSwitcher = window.openPage;
  if(typeof kalbOldOpenPageForAccountSwitcher === "function"){
    window.openPage = function(id, el){
      const res = kalbOldOpenPageForAccountSwitcher.apply(this, arguments);
      if(id === "settingsPage") setTimeout(()=>{ try{ window.renderAccountSwitcher && window.renderAccountSwitcher(); }catch(e){} },50);
      return res;
    };
  }
}catch(e){console.warn("Account switcher openPage wrapper failed",e)}
