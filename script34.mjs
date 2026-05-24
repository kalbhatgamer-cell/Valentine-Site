
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clean=v=>String(v||'').trim();
function status(msg,good=true){
  const ids=['maintenanceStatusMsg','maintStatus','maintenanceMsg','appUpdateStatus','adminStatus'];
  let el=ids.map($).find(Boolean);
  if(!el){el=document.createElement('div');el.id='maintenanceStatusMsg';el.className='card';document.querySelector('#settingsPage,.settings,.page.active,main,body')?.appendChild(el);}
  el.textContent=msg;
  el.style.display='block';
  el.style.borderColor=good?'rgba(34,197,94,.55)':'rgba(239,68,68,.55)';
  el.style.background=good?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)';
}
function getUid(){return auth.currentUser?.uid||window.__kalbCurrentUid||localStorage.getItem('kalbLastUid')||'';}
function rememberUser(u){if(u?.uid){window.__kalbCurrentUid=u.uid;try{localStorage.setItem('kalbLastUid',u.uid)}catch(e){}}}
onAuthStateChanged(auth,rememberUser);
function selectMaintenanceValue(){
  const sels=[...document.querySelectorAll('select')];
  const s=sels.find(x=>/maintenance/i.test(x.id+x.name+x.closest('.card,.section,div')?.textContent)) || sels.find(x=>[...x.options].some(o=>/maintenance/i.test(o.textContent)));
  return s||null;
}
function isMaintenanceOnFromUI(){
  const s=selectMaintenanceValue();
  if(!s)return false;
  const opt=s.options[s.selectedIndex];
  const v=((s.value||'')+' '+(opt?.textContent||'')).toLowerCase();
  return v.includes('on')||v.includes('true')||v==='1';
}
function setMaintenanceUI(on){
  const s=selectMaintenanceValue();
  if(s){
    const want=on?'on':'off';
    const option=[...s.options].find(o=>((o.value+' '+o.textContent).toLowerCase()).includes(want));
    if(option){s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));}
  }
}
function hideMaintenanceScreens(){
  document.querySelectorAll('#maintenanceOverlay,#kalbMaintenanceOverlay,.maintenance-overlay,.maintenance-screen,[data-maintenance-screen]').forEach(el=>{
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('pointer-events','none','important');
  });
  document.body.classList.remove('maintenance-on','kalb-maintenance-on','app-maintenance');
  document.documentElement.classList.remove('maintenance-on','kalb-maintenance-on','app-maintenance');
}
async function writeDocSafe(ref,data){
  try{await setDoc(ref,data,{merge:true});return true;}catch(e){try{await updateDoc(ref,data);return true;}catch(_){return false;}}
}
async function cloudSaveMaintenance(on,notice){
  const data={on:!!on,enabled:!!on,isOn:!!on,maintenance:!!on,maintenanceMode:!!on,active:!!on,status:on?'on':'off',mode:on?'on':'off',notice:notice||'',message:notice||'',updatedAt:serverTimestamp(),updatedBy:getUid()||'admin'};
  const refs=[
    doc(db,'appConfig','maintenance'),doc(db,'settings','maintenance'),doc(db,'admin','maintenance'),doc(db,'config','maintenance'),doc(db,'system','maintenance'),doc(db,'kalbConfig','maintenance'),
    doc(db,'appConfig','global'),doc(db,'settings','global'),doc(db,'adminSettings','maintenance'),doc(db,'publicConfig','maintenance')
  ];
  const jobs=refs.map(r=>writeDocSafe(r,data));
  const timeout=sleep(4500).then(()=>false);
  const results=await Promise.race([Promise.all(jobs),timeout]);
  return Array.isArray(results)?results.some(Boolean):false;
}
window.kalbForceMaintenanceOff=async function(){
  try{localStorage.setItem('kalbMaintenanceLocalOverride','off');localStorage.setItem('kalbMaintenanceMode','off');}catch(e){}
  setMaintenanceUI(false); hideMaintenanceScreens(); status('Maintenance OFF saved locally. Syncing cloud...',true);
  const ok=await cloudSaveMaintenance(false,$('maintenanceNotice')?.value||$('maintenanceText')?.value||'');
  hideMaintenanceScreens(); setMaintenanceUI(false);
  status(ok?'Maintenance OFF saved. Users can access the app now.':'Maintenance OFF applied on this device. Cloud save may be blocked by rules, but this browser is unlocked.',ok);
};
window.kalbAdminSaveMaintenance=async function(){
  const on=isMaintenanceOnFromUI();
  const notice=$('maintenanceNotice')?.value||$('maintenanceText')?.value||$('maintenanceMessage')?.value||'';
  try{localStorage.setItem('kalbMaintenanceLocalOverride',on?'on':'off');localStorage.setItem('kalbMaintenanceMode',on?'on':'off');}catch(e){}
  if(!on){hideMaintenanceScreens();}
  status('Saving Maintenance '+(on?'ON':'OFF')+'...',true);
  const ok=await cloudSaveMaintenance(on,notice);
  if(!on){hideMaintenanceScreens();}
  status(ok?('Maintenance '+(on?'ON':'OFF')+' saved successfully.'):('Maintenance '+(on?'ON':'OFF')+' applied locally. Cloud save may be blocked by Firebase rules.'),ok);
};
window.kalbLoadMaintenanceStatus=async function(){
  const override=localStorage.getItem('kalbMaintenanceLocalOverride');
  if(override==='off'){setMaintenanceUI(false);hideMaintenanceScreens();status('Maintenance is OFF on this device.',true);return;}
  for(const r of [doc(db,'appConfig','maintenance'),doc(db,'settings','maintenance'),doc(db,'admin','maintenance'),doc(db,'config','maintenance'),doc(db,'system','maintenance')]){
    try{const s=await getDoc(r); if(s.exists()){const d=s.data(); const on=d.on===true||d.enabled===true||d.isOn===true||d.maintenanceMode===true||d.status==='on'||d.mode==='on'; setMaintenanceUI(on); if(!on)hideMaintenanceScreens(); status('Maintenance status loaded.',true); return;}}catch(e){}
  }
  status('Maintenance status loaded.',true);
};
// Capture clicks on old maintenance button even when old inline handlers fail.
document.addEventListener('click',e=>{
  const b=e.target.closest('button,.btn'); if(!b)return;
  const t=(b.textContent||'').toLowerCase();
  if(t.includes('save maintenance')){e.preventDefault();e.stopPropagation();window.kalbAdminSaveMaintenance();}
  if(t.includes('refresh status')){e.preventDefault();e.stopPropagation();window.kalbLoadMaintenanceStatus();}
},true);
setInterval(()=>{if(localStorage.getItem('kalbMaintenanceLocalOverride')==='off'||localStorage.getItem('kalbMaintenanceMode')==='off')hideMaintenanceScreens();},900);

// ---------- Chat Open repair ----------
async function getUser(uid){if(!uid)return null;try{const s=await getDoc(doc(db,'users',uid));return s.exists()?{uid,...s.data()}:null;}catch(e){return null;}}
async function allUsers(){try{return (await getDocs(collection(db,'users'))).docs.map(d=>({uid:d.id,...d.data()}));}catch(e){return[]}}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9@._-]/g,'');}
async function resolveChatOther(chatId,hint){
  const me=getUid(); let data={};
  try{const s=await getDoc(doc(db,'chats',chatId)); if(s.exists())data=s.data();}catch(e){}
  const members=[...(Array.isArray(data.members)?data.members:[]),...(Array.isArray(data.users)?data.users:[]),...(Array.isArray(data.participants)?data.participants:[])].filter(Boolean).map(String);
  const candidates=[];
  [data.otherUid,data.uid,data.userId,data.receiverUid,data.senderUid,hint,...members,...String(chatId||'').split(/[|_:-]/)].forEach(v=>{v=clean(v);if(v&&v!==me&&!candidates.includes(v))candidates.push(v)});
  for(const c of candidates){const u=await getUser(c); if(u)return c;}
  const names=Object.values(data.memberNames||{}).concat([hint,data.name,data.displayName,data.otherName]).filter(Boolean).map(norm);
  const users=await allUsers();
  for(const u of users){if(u.uid!==me && names.some(n=>n && [u.name,u.displayName,u.username,u.email].some(x=>norm(x)===n)))return u.uid;}
  for(const u of users){if(u.uid!==me && candidates.some(c=>[u.name,u.displayName,u.username,u.email].some(x=>norm(x)===norm(c))))return u.uid;}
  return candidates[0]||'';
}
const originalOpenPrivateChat=window.openPrivateChat;
window.kalbOpenChatFromList=async function(chatId,hint){
  try{
    const uid=await resolveChatOther(chatId,hint);
    if(uid){
      if(typeof originalOpenPrivateChat==='function') return originalOpenPrivateChat(uid);
      if(typeof window.openPrivateChat==='function' && window.openPrivateChat!==window.kalbOpenChatFromList) return window.openPrivateChat(uid);
    }
  }catch(e){console.warn('safe chat open failed',e);}
  alert('Chat user not found. Please open this user from Search once, then the chat will reconnect.');
};
if(typeof originalOpenPrivateChat==='function'){
  window.openPrivateChat=async function(uid){
    const fixed=await resolveChatOther('',uid);
    return originalOpenPrivateChat(fixed||uid);
  };
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button,.btn'); if(!b)return;
  if((b.textContent||'').trim().toLowerCase()==='open'){
    const card=b.closest('[data-chat-id]');
    if(card){e.preventDefault();e.stopPropagation();window.kalbOpenChatFromList(card.getAttribute('data-chat-id'),card.querySelector('h3')?.textContent||'');}
  }
},true);

// ---------- Feed comments + reaction repair ----------
function postIdFromBox(box){return box?.getAttribute('data-post-id')||box?.dataset?.postId||box?.id?.replace(/^post[-_]/,'')||'';}
window.kalbToggleComments=function(postId,key='fix'){
  const box=[...document.querySelectorAll('.post-box,[data-post-id]')].find(b=>postIdFromBox(b)===postId);
  if(!box)return;
  let panel=box.querySelector('.kalb-comment-panel');
  if(!panel){
    panel=document.createElement('div');panel.className='kalb-comment-panel';panel.innerHTML=`<div id="kalbCommentList_fix_${esc(postId)}" class="kalb-comment-list"><p class="muted">Loading comments...</p></div><div class="kalb-comment-compose"><input id="kalbCommentInput_fix_${esc(postId)}" placeholder="Write a comment..."><button class="btn small" onclick="kalbAddComment('${esc(postId)}','fix')">Send</button></div>`;box.appendChild(panel);
  }
  panel.classList.toggle('show');
  if(panel.classList.contains('show') && typeof window.kalbLoadComments==='function') window.kalbLoadComments(postId,'fix');
};
async function patchPostDoc(postId,patch){try{await updateDoc(doc(db,'posts',postId),patch);return true;}catch(e){try{await setDoc(doc(db,'posts',postId),patch,{merge:true});return true;}catch(_){return false;}}}
window.kalbFeedFixReact=async function(postId,emoji){
  const uid=getUid(); if(!uid)return alert('Login first.');
  const s=await getDoc(doc(db,'posts',postId)); const p=s.exists()?s.data():{}; const reactions=p.reactions||{};
  const next={}; ['❤️','😂','😮','😢','👍'].forEach(e=>{next[e]=Array.isArray(reactions[e])?reactions[e].filter(x=>x!==uid):[];});
  if(!next[emoji])next[emoji]=[]; next[emoji].push(uid);
  const likes=Array.from(new Set([...(Array.isArray(p.likes)?p.likes:[]),...(emoji==='❤️'?[uid]:[])])).filter(x=>emoji==='❤️'||x!==uid);
  await patchPostDoc(postId,{reactions:next,likes,updatedAt:serverTimestamp()});
  setTimeout(()=>{try{window.kalbFeedFixRender?.();window.renderPosts?.();ensureCommentButtons();}catch(e){}},250);
};
window.kalbFeedFixLike=async function(postId){return window.kalbFeedFixReact(postId,'❤️');};
function ensureCommentButtons(){
  document.querySelectorAll('.post-box,[data-post-id]').forEach(box=>{
    const postId=postIdFromBox(box); if(!postId)return;
    let actions=box.querySelector('.post-actions,.actions'); if(!actions){actions=document.createElement('div');actions.className='post-actions';box.appendChild(actions);}
    const has=[...actions.querySelectorAll('button')].some(b=>/comment/i.test(b.textContent||''));
    if(!has){
      const btn=document.createElement('button');btn.className='btn small kalb-comment-auto-btn';btn.textContent='Comments (0)';btn.addEventListener('click',ev=>{ev.preventDefault();window.kalbToggleComments(postId,'fix');});
      const save=[...actions.querySelectorAll('button')].find(b=>/save/i.test(b.textContent||''));
      actions.insertBefore(btn,save||null);
    }
    actions.querySelectorAll('button').forEach(b=>{b.style.display='inline-flex';b.style.visibility='visible';b.style.opacity='1';b.style.pointerEvents='auto';});
  });
}
setInterval(ensureCommentButtons,1200);

// ---------- Daily spin 24-hour persistence repair ----------
const DAY=24*60*60*1000;
function spinKeys(){const uid=getUid();const keys=['kalbDailySpinLastAt_global']; if(uid)keys.push('kalbDailySpinLastAt_'+uid);return keys;}
function getLastSpin(){let m=0;Object.keys(localStorage).forEach(k=>{if(k==='kalbDailySpinLastAt_global'||k.startsWith('kalbDailySpinLastAt_')){const v=Number(localStorage.getItem(k)||0);if(v>m)m=v;}});return m;}
function saveLastSpin(t=Date.now()){try{spinKeys().forEach(k=>localStorage.setItem(k,String(t)));}catch(e){}}
function applySpinCooldown(){
  const last=getLastSpin(); const rem=last+DAY-Date.now();
  const cd=$('kalbSpinCountdown')||document.querySelector('[id*="SpinCountdown"],.spin-countdown');
  const btn=$('kalbSpinButton')||document.querySelector('button[onclick*="SpinDaily"],button[onclick*="spin"]');
  if(rem>0){
    const h=String(Math.floor(rem/3600000)).padStart(2,'0'),m=String(Math.floor(rem%3600000/60000)).padStart(2,'0'),s=String(Math.floor(rem%60000/1000)).padStart(2,'0');
    if(cd)cd.textContent='Next spin in : '+h+':'+m+':'+s;
    if(btn && /spin/i.test(btn.textContent||'')){btn.disabled=true;btn.style.opacity='.65';}
  }else{
    if(cd)cd.textContent='Spin available : Ready now';
    if(btn && /spin/i.test(btn.textContent||'')){btn.disabled=false;btn.style.opacity='1';}
  }
}
const oldSpin=window.kalbSpinDailyWheel;
window.kalbSpinDailyWheel=async function(){
  const last=getLastSpin();
  if(last+DAY>Date.now()){applySpinCooldown();return;}
  const started=Date.now();
  const result=oldSpin?oldSpin.apply(this,arguments):undefined;
  setTimeout(()=>saveLastSpin(started),350);
  setTimeout(()=>{saveLastSpin(started);applySpinCooldown();},4300);
  return result;
};
const oldRenderSpin=window.kalbRenderDailySpinWheel;
window.kalbRenderDailySpinWheel=function(){try{const last=getLastSpin();if(last)saveLastSpin(last);}catch(e){} const r=oldRenderSpin?oldRenderSpin.apply(this,arguments):undefined; setTimeout(applySpinCooldown,120); return r;};
setInterval(applySpinCooldown,1000);
document.addEventListener('click',e=>{
  const b=e.target.closest('button,.btn'); if(!b)return;
  if(/spin now|^spin$/i.test((b.textContent||'').trim())){
    const last=getLastSpin(); if(last+DAY>Date.now()){e.preventDefault();e.stopPropagation();applySpinCooldown();return;}
    setTimeout(()=>saveLastSpin(Date.now()),350);
  }
},true);

setTimeout(()=>{ensureCommentButtons();applySpinCooldown();if(localStorage.getItem('kalbMaintenanceLocalOverride')==='off')hideMaintenanceScreens();},1000);


/* KALB FINAL CLEAN PATCH: DELETE MAINTENANCE SYSTEM + HARD FIX CHAT OPEN + ADMIN USER CONTROL */
(function(){
  const KALB_PATCH_TAG = 'kalb-final-no-maintenance-chat-admin-v1';
  if(window[KALB_PATCH_TAG]) return;
  window[KALB_PATCH_TAG] = true;

  function safeText(x){return String(x||'').trim();}
  function firstName(u){return safeText(u?.name||u?.displayName||u?.username||u?.email||'User');}
  function firstAvatar(u){return safeText(u?.avatar||u?.photoURL||u?.avatarEmoji||u?.emoji||'👤');}
  function allUserCandidates(){
    try{
      const fromAll = Array.isArray(allUsers) ? allUsers : [];
      const fromWin = Array.isArray(window.allUsers) ? window.allUsers : [];
      const map = new Map();
      [...fromAll,...fromWin].forEach(u=>{ if(!u) return; const id=u.id||u.uid; if(id) map.set(id,{...u,id,uid:id}); });
      return [...map.values()];
    }catch(e){ return Array.isArray(window.allUsers)?window.allUsers:[]; }
  }
  async function fetchAllUsersFinal(){
    const cached = allUserCandidates();
    try{
      const snap = await getDocs(collection(db,'users'));
      const loaded=[];
      snap.forEach(d=>loaded.push({id:d.id,uid:d.id,...(d.data()||{})}));
      if(loaded.length){
        try{ allUsers = loaded; }catch(e){}
        window.allUsers = loaded;
        return loaded;
      }
    }catch(e){ console.warn('final user load failed', e); }
    return cached;
  }
  async function findUserFinal(value, displayName){
    let raw = safeText(value).replace(/^['"]|['"]$/g,'');
    const wanted = raw.toLowerCase();
    let users = allUserCandidates();
    function matchIn(list){
      if(!wanted) return null;
      return (list||[]).find(u=>{
        const vals=[u.id,u.uid,u.email,u.username,u.name,u.displayName,u.kalbId,u.kalbID,u.userId,u.ownerId,u.handle].map(x=>safeText(x).toLowerCase());
        return vals.includes(wanted);
      }) || null;
    }
    let u = matchIn(users);
    if(u) return {...u,id:u.id||u.uid,uid:u.uid||u.id};
    if(raw){
      try{ const s=await getDoc(doc(db,'users',raw)); if(s.exists()) return {id:s.id,uid:s.id,...(s.data()||{})}; }catch(e){}
    }
    users = await fetchAllUsersFinal();
    u = matchIn(users);
    if(u) return {...u,id:u.id||u.uid,uid:u.uid||u.id};
    const name = safeText(displayName).toLowerCase();
    if(name){
      u=(users||[]).find(x=>[x.name,x.displayName,x.username,x.email].some(v=>safeText(v).toLowerCase()===name));
      if(!u) u=(users||[]).find(x=>safeText(x.name||x.displayName||x.username||x.email).toLowerCase().includes(name));
      if(u) return {...u,id:u.id||u.uid,uid:u.uid||u.id};
    }
    return null;
  }

  async function finalOpenPrivateChat(target, displayName){
    try{
      if(!auth?.currentUser && !currentUser){ alert('Login first.'); return false; }
      const me = auth?.currentUser || currentUser;
      const raw = safeText(target);
      let user = null;

      // If target is a chat document id, get the other member from the chat doc.
      if(raw && !raw.includes('@')){
        try{
          const cs = await getDoc(doc(db,'chats',raw));
          if(cs.exists()){
            const cd = cs.data() || {};
            const members = Array.isArray(cd.members) ? cd.members : (Array.isArray(cd.participants) ? cd.participants : []);
            const other = members.find(x=>x && x !== me.uid) || raw.replace(me.uid,'').replace(/[_:|]/g,'');
            user = await findUserFinal(other, displayName);
          }
        }catch(e){}
      }
      if(!user) user = await findUserFinal(raw, displayName);
      if(!user){ alert('User not found.'); return false; }
      const uid = user.uid || user.id;
      if(!uid || uid === me.uid){ alert('User not found.'); return false; }

      // Block system is still respected, but it no longer breaks normal chat opening.
      try{ if(typeof blockedByMe==='function' && blockedByMe(uid)){ alert('You blocked this user. Unblock first.'); return false; } }catch(e){}
      try{ if(typeof blockedMe==='function' && blockedMe(uid)){ alert('This user is not available for messages.'); return false; } }catch(e){}

      const chatId = (typeof chatIdForUser === 'function') ? chatIdForUser(uid) : [me.uid, uid].sort().join('_');
      const myName = firstName((typeof myProfile!=='undefined' ? myProfile : null) || {name:me.displayName,email:me.email});
      const otherName = firstName(user);
      const memberNames = {}; memberNames[me.uid]=myName; memberNames[uid]=otherName;
      const memberAvatars = {}; memberAvatars[me.uid]=firstAvatar(typeof myProfile!=='undefined'?myProfile:null); memberAvatars[uid]=firstAvatar(user);
      try{
        await setDoc(doc(db,'chats',chatId),{
          members:[me.uid,uid],
          memberNames,
          memberAvatars,
          updatedAt:serverTimestamp(),
          lastMessageAt:serverTimestamp(),
          type:'private'
        },{merge:true});
      }catch(e){ console.warn('chat doc create/update failed', e); }
      try{ if(typeof restoreDeletedChat==='function') restoreDeletedChat(chatId); }catch(e){}
      try{ if(typeof setArchivedChats==='function') setArchivedChats((getArchivedChats?.()||[]).filter(id=>id!==chatId)); }catch(e){}

      try{ currentChatId = chatId; currentChatUser = {...user,id:uid,uid}; }catch(e){}
      const titleEl=document.getElementById('roomTitle'); if(titleEl) titleEl.textContent = otherName;
      const subEl=document.getElementById('roomSubtitle'); if(subEl) subEl.textContent = user.username?('@'+user.username):'Private chat';
      const wall=localStorage.getItem('kalbChatWallpaper')||''; const room=document.getElementById('chatRoomPage');
      if(room) room.style.backgroundImage = wall?`linear-gradient(rgba(2,6,23,.78),rgba(2,6,23,.78)),url(${wall})`:'';
      try{ if(typeof listenPrivateMessages==='function') listenPrivateMessages(chatId); }catch(e){ console.warn('listenPrivateMessages failed', e); }
      try{ if(typeof openPage==='function') openPage('chatRoomPage'); else document.getElementById('chatRoomPage')?.classList.add('active'); }catch(e){}
      try{ await updateDoc(doc(db,'users',me.uid),{lastActive:serverTimestamp()}); }catch(e){}
      return true;
    }catch(e){ console.error(e); alert(e.message || 'Could not open chat.'); return false; }
  }

  window.openPrivateChat = finalOpenPrivateChat;
  window.kalbOpenPrivateChat = finalOpenPrivateChat;
  window.kalbOpenChatFromList = async function(chatId, name){ return finalOpenPrivateChat(chatId, name); };
  window.startPrivateChat = async function(uid){ return finalOpenPrivateChat(uid); };

  document.addEventListener('click', async function(e){
    const btn = e.target.closest && e.target.closest('button');
    if(!btn) return;
    const txt = safeText(btn.textContent).toLowerCase();
    if(!['open','message'].includes(txt)) return;
    const page = btn.closest('#chatsPage,#usersPage,#searchPage,.page');
    const pageText = safeText(page?.id || page?.className || '');
    const card = btn.closest('[data-chat-id],[data-fixed-chat-id],[data-uid],[data-user-id],.chat-card,.user-card,.kalb-card,.card,.glass');
    const cardTxt = safeText(card?.textContent);
    const looksChat = pageText.toLowerCase().includes('chat') || cardTxt.includes('Sticker') || cardTxt.includes('Last seen') || cardTxt.includes('Archive');
    const looksUserMessage = txt==='message' && (pageText.toLowerCase().includes('user') || pageText.toLowerCase().includes('search') || cardTxt.includes('Hey there'));
    if(!looksChat && !looksUserMessage) return;
    e.preventDefault(); e.stopPropagation();
    let raw = btn.getAttribute('data-uid') || btn.dataset.uid || card?.dataset?.uid || card?.dataset?.userId || card?.dataset?.chatId || card?.dataset?.fixedChatId || '';
    const on = btn.getAttribute('onclick') || '';
    const m = on.match(/['"]([^'"]{6,})['"]/);
    if(!raw && m) raw=m[1];
    const nameEl = card?.querySelector('h3,h4,b,strong,.name,.user-name');
    const name = safeText(nameEl?.textContent || cardTxt.split('\n')[0]);
    await finalOpenPrivateChat(raw, name);
  }, true);

  async function populateAdminUserControlsFinal(){
    const users = await fetchAllUsersFinal();
    if(!users.length) return;
    const controls = [...document.querySelectorAll('select')].filter(sel=>{
      const id = (sel.id+' '+sel.name+' '+(sel.closest('.card,.kalb-tool-item,.settings-card,section,div')?.textContent||'')).toLowerCase();
      const first = safeText(sel.options?.[0]?.textContent).toLowerCase();
      return (id.includes('admin') && id.includes('user')) || first.includes('select user') || first.includes('kalb id');
    }).filter(sel=>![...sel.options].some(o=>/maintenance on|maintenance off/i.test(o.textContent)));
    controls.forEach(sel=>{
      const current = sel.value;
      sel.innerHTML = '<option value="">Select user by Kalb ID</option>' + users.map(u=>{
        const id = u.uid||u.id;
        const name = firstName(u);
        const user = safeText(u.username ? '@'+u.username : (u.email||''));
        const kid = safeText(u.kalbId||u.kalbID||u.userId||id.slice(0,8));
        return `<option value="${id}">${name} · ${user} · ${kid}</option>`;
      }).join('');
      if(current && [...sel.options].some(o=>o.value===current)) sel.value=current;
    });
    const box = document.getElementById('adminUsersBox') || document.getElementById('adminUserControlList') || document.querySelector('[data-admin-users]');
    if(box){
      box.innerHTML = users.map(u=>{
        const id=u.uid||u.id;
        const name=firstName(u);
        const uname=safeText(u.username?('@'+u.username):u.email||'');
        const kid=safeText(u.kalbId||u.kalbID||u.userId||id.slice(0,8));
        return `<div class="mini-card" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>${name}</b><br><span class="muted">${uname} · ID: ${kid}</span></div><button type="button" data-uid="${id}" onclick="openPrivateChat('${id}')">Message</button></div>`;
      }).join('');
    }
  }
  window.kalbRefreshAdminUsers = populateAdminUserControlsFinal;

  function removeMaintenanceUIFinal(){
    try{
      document.querySelectorAll('#kalbMaintenanceOverlay,#maintenanceOverlay,.kalb-maintenance-overlay,.maintenance-overlay,.maintenance-screen,[data-maintenance-screen]').forEach(el=>{el.remove();});
      document.body.classList.remove('maintenance-on','kalb-maintenance-on','app-maintenance');
      document.documentElement.classList.remove('maintenance-on','kalb-maintenance-on','app-maintenance');
      document.querySelectorAll('h1,h2,h3,h4,p,div,span').forEach(el=>{
        if(el.childElementCount>2) return;
        if(el.textContent.includes('App Update + Maintenance Control')) el.innerHTML = el.innerHTML.replace('App Update + Maintenance Control','App Update Control');
        if(el.textContent.includes('turn maintenance mode on/off')) el.textContent='Admin can publish version info and APK update details.';
      });
      document.querySelectorAll('select').forEach(sel=>{
        if([...sel.options].some(o=>/maintenance on|maintenance off/i.test(o.textContent))){
          sel.value='off'; sel.style.display='none'; sel.setAttribute('data-maintenance-deleted','1');
        }
      });
      document.querySelectorAll('button,input,textarea').forEach(el=>{
        const t=safeText(el.textContent || el.value || el.placeholder).toLowerCase();
        if(t.includes('save maintenance mode') || t.includes('refresh status') || t.includes('maintenance off') || t.includes('maintenance on') || t.includes('we are improving kalb message')){
          el.style.display='none'; el.disabled=true; el.setAttribute('data-maintenance-deleted','1');
        }
      });
      document.querySelectorAll('*').forEach(el=>{
        const t=safeText(el.textContent).toLowerCase();
        if(el.id && /maintenance/i.test(el.id) && !/appupdate|version|apk/i.test(el.id)){ el.style.display='none'; }
        if((t==='maintenance status loaded.' || t==='maintenance mode is on.' || t==='maintenance mode is off.') && el.childElementCount===0) el.style.display='none';
      });
    }catch(e){}
  }

  async function forceDeleteMaintenanceSystemFinal(){
    try{ localStorage.setItem('kalbMaintenanceForceOff','1'); localStorage.setItem('kalbMaintenanceBackup', JSON.stringify({enabled:false,on:false,isOn:false,status:'off',mode:'off',message:''})); }catch(e){}
    try{ maintenanceData = {enabled:false,message:''}; }catch(e){}
    try{ fixedMaintenance = {enabled:false,message:''}; }catch(e){}
    try{ setMaintenanceUI?.(false); }catch(e){}
    try{ hideMaintenanceScreens?.(); }catch(e){}
    removeMaintenanceUIFinal();
    const payload={enabled:false,on:false,isOn:false,active:false,maintenance:false,maintenanceMode:false,status:'off',mode:'off',message:'',notice:'',deleted:true,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||'system'};
    const refs=[
      ['appConfig','maintenance'],['settings','maintenance'],['publicConfig','maintenance'],['adminConfig','maintenance'],['appSettings','maintenance'],['config','maintenance'],['global','maintenance'],['public','maintenance'],['maintenance','status'],['admin','maintenance'],['system','maintenance'],['kalbConfig','maintenance'],['appConfig','global'],['settings','global'],['adminSettings','maintenance']
    ];
    for(const [c,d] of refs){ try{ await setDoc(doc(db,c,d),payload,{merge:true}); }catch(e){} }
  }
  window.kalbDeleteMaintenanceSystem = forceDeleteMaintenanceSystemFinal;
  window.kalbAdminSaveMaintenance = async function(){ await forceDeleteMaintenanceSystemFinal(); alert('Maintenance system removed and turned OFF.'); };
  window.kalbAdminLoadMaintenance = async function(){ await forceDeleteMaintenanceSystemFinal(); };

  const oldOpenPage = window.openPage;
  if(typeof oldOpenPage === 'function'){
    window.openPage = function(id){ const r=oldOpenPage.apply(this,arguments); setTimeout(()=>{removeMaintenanceUIFinal(); populateAdminUserControlsFinal();},100); return r; };
  }
  document.addEventListener('DOMContentLoaded',()=>{ removeMaintenanceUIFinal(); populateAdminUserControlsFinal(); forceDeleteMaintenanceSystemFinal(); });
  setTimeout(()=>{ removeMaintenanceUIFinal(); populateAdminUserControlsFinal(); forceDeleteMaintenanceSystemFinal(); },1200);
  setInterval(removeMaintenanceUIFinal,2000);
  setInterval(populateAdminUserControlsFinal,10000);
})();

