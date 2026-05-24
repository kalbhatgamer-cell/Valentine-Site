
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, query, orderBy, limit, updateDoc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const THEMES=[
  {id:'amoled',name:'AMOLED',desc:'Pure black premium battery saver.',cls:'kalb-theme-amoled'},
  {id:'anime',name:'Anime Glow',desc:'Pink, purple and cyan anime style.',cls:'kalb-theme-anime'},
  {id:'gaming',name:'Gaming',desc:'Green neon esports style.',cls:'kalb-theme-gaming'},
  {id:'midnight',name:'Midnight Pro',desc:'Dark blue and violet premium look.',cls:'kalb-theme-midnight'},
  {id:'fire',name:'Fire',desc:'Red orange creator theme.',cls:'kalb-theme-fire'},
  {id:'oceanplus',name:'Ocean Plus',desc:'Blue teal clean theme.',cls:'kalb-theme-oceanplus'}
];
const themeClasses=THEMES.map(t=>'kalb-market-'+t.id);
let kalbThemeUser=auth.currentUser;
function me(){return auth.currentUser||kalbThemeUser||window.currentUser||null;}
function chatUid(){return String(window.__kalbCurrentChatUid||window.__kalbActiveChatUid||'');}
function chatId(){const u=me(); const other=chatUid(); return u&&other?[u.uid,other].sort().join('_'):'';}
function installedThemes(){try{return JSON.parse(localStorage.getItem('kalbInstalledMarketplaceThemes')||'["amoled","midnight"]')}catch(e){return ['amoled','midnight'];}}
function saveInstalled(list){localStorage.setItem('kalbInstalledMarketplaceThemes',JSON.stringify(Array.from(new Set(list))));}
function activeTheme(){return localStorage.getItem('kalbActiveMarketplaceTheme')||'';}
function setThemeStatus(txt){const el=document.getElementById('kalbThemeMarketStatus'); if(el)el.textContent=txt||'';}
function applyMarketplaceTheme(id){
  document.body.classList.remove(...themeClasses);
  if(id){document.body.classList.add('kalb-market-'+id);localStorage.setItem('kalbActiveMarketplaceTheme',id);}
  const name=THEMES.find(t=>t.id===id)?.name||'Default';
  setThemeStatus('Active theme: '+name);
  renderThemeMarketplace();
}
window.kalbInstallMarketplaceTheme=function(id){
  const list=installedThemes(); if(!list.includes(id))list.push(id); saveInstalled(list); renderThemeMarketplace(); setThemeStatus('Theme installed. Tap Apply to use it.');
};
window.kalbApplyMarketplaceTheme=function(id){
  if(!installedThemes().includes(id)) window.kalbInstallMarketplaceTheme(id);
  applyMarketplaceTheme(id);
};
window.kalbRemoveMarketplaceTheme=function(id){
  let list=installedThemes().filter(x=>x!==id); saveInstalled(list);
  if(activeTheme()===id){localStorage.removeItem('kalbActiveMarketplaceTheme'); document.body.classList.remove(...themeClasses);}
  renderThemeMarketplace(); setThemeStatus('Theme removed from this device.');
};
window.kalbResetMarketplaceTheme=function(){localStorage.removeItem('kalbActiveMarketplaceTheme');document.body.classList.remove(...themeClasses);renderThemeMarketplace();setThemeStatus('Theme reset to default.');};
function renderThemeMarketplace(){
  const box=document.getElementById('kalbThemeMarketplaceList'); if(!box)return;
  const installed=installedThemes(); const active=activeTheme();
  box.innerHTML=THEMES.map(t=>{
    const has=installed.includes(t.id); const on=active===t.id;
    return `<div class="kalb-theme-card ${t.cls}"><div><b>${esc(t.name)} ${has?'<span class="kalb-installed-tag">Installed</span>':''}</b><p>${esc(t.desc)}</p></div><div class="actions">${has?`<button class="btn small green" onclick="kalbApplyMarketplaceTheme('${t.id}')">${on?'Applied':'Apply'}</button><button class="btn small red" onclick="kalbRemoveMarketplaceTheme('${t.id}')">Remove</button>`:`<button class="btn small" onclick="kalbInstallMarketplaceTheme('${t.id}')">Install</button>`}</div></div>`;
  }).join('');
}
function injectThemeMarketplace(){
  const page=document.getElementById('themePage'); if(!page||document.getElementById('kalbThemeMarketplaceCard'))return;
  const card=document.createElement('div'); card.className='card kalb-theme-store-card'; card.id='kalbThemeMarketplaceCard';
  card.innerHTML=`<div class="kalb-theme-store-head"><div><h3>🎨 App Themes Marketplace</h3><p class="muted">Install and apply community style themes. This is saved on this device and does not change Dashboard feed features.</p></div><button class="btn small red" onclick="kalbResetMarketplaceTheme()">Reset Theme</button></div><div id="kalbThemeMarketplaceList" class="kalb-theme-grid"></div><div id="kalbThemeMarketStatus" class="kalb-theme-status"></div>`;
  page.appendChild(card); renderThemeMarketplace(); if(activeTheme())applyMarketplaceTheme(activeTheme()); else setThemeStatus('Choose a theme to install.');
}

function chatSettingKey(suffix){return 'kalb_'+suffix+'_'+(me()?.uid||'guest')+'_'+(chatId()||'nochat');}
function getDisappearSeconds(){return Number(localStorage.getItem(chatSettingKey('disappear_seconds'))||'0')||0;}
function isSecretOn(){return localStorage.getItem(chatSettingKey('secret_mode'))==='1';}
function syncSecretControls(){
  const sec=getDisappearSeconds(); const sel=document.getElementById('kalbDisappearSelect'); if(sel)sel.value=String(sec);
  const secret=isSecretOn(); const b=document.getElementById('kalbSecretToggleBtn'); if(b){b.textContent=secret?'Secret Mode ON':'Secret Mode OFF'; b.classList.toggle('green',secret);}
  const badge=document.getElementById('kalbSecretStatusBadge'); if(badge)badge.textContent=secret?'Secret Active':'Normal Chat';
  const note=document.getElementById('kalbSecretNote'); if(note)note.innerHTML=secret?'🔒 Secret Chat Mode is ON. Disappearing timer and privacy warning are active for this chat on this device.':'Choose a disappearing timer or turn on Secret Mode for this chat.';
}
async function saveChatSettingsToCloud(){
  const id=chatId(); const u=me(); if(!id||!u)return;
  try{await setDoc(doc(db,'chats',id),{secretModeBy:{[u.uid]:isSecretOn()},disappearingBy:{[u.uid]:getDisappearSeconds()},updatedAt:serverTimestamp()},{merge:true});}catch(e){console.warn('Chat setting saved locally only',e);}
}
window.kalbSetDisappearingMessages=async function(seconds){
  const id=chatId(); if(!id)return alert('Open a chat first.');
  seconds=Number(seconds)||0; localStorage.setItem(chatSettingKey('disappear_seconds'),String(seconds));
  if(seconds>0 && isSecretOn()===false && document.getElementById('kalbSecretAutoCheck')?.checked){localStorage.setItem(chatSettingKey('secret_mode'),'1');}
  syncSecretControls(); await saveChatSettingsToCloud();
};
window.kalbToggleSecretChat=async function(){
  const id=chatId(); if(!id)return alert('Open a chat first.');
  const next=!isSecretOn(); localStorage.setItem(chatSettingKey('secret_mode'),next?'1':'0');
  if(next && getDisappearSeconds()===0)localStorage.setItem(chatSettingKey('disappear_seconds'),'60');
  syncSecretControls(); await saveChatSettingsToCloud();
};
function injectSecretChatControls(){
  const page=document.getElementById('chatRoomPage'); const top=page?.querySelector('.card'); if(!page||!top||document.getElementById('kalbSecretChatCard'))return;
  const card=document.createElement('div'); card.className='kalb-secret-chat-card'; card.id='kalbSecretChatCard';
  card.innerHTML=`<div class="kalb-secret-head"><div><h3>🔒 Secret Chat</h3><p class="muted">Set messages to auto-delete in this chat only.</p></div><span id="kalbSecretStatusBadge" class="kalb-secret-on-badge">Normal Chat</span></div><div class="kalb-secret-controls"><select id="kalbDisappearSelect" onchange="kalbSetDisappearingMessages(this.value)"><option value="0">Disappearing: Off</option><option value="10">Auto-delete: 10 sec</option><option value="60">Auto-delete: 1 min</option><option value="86400">Auto-delete: 1 day</option></select><button class="btn small" id="kalbSecretToggleBtn" onclick="kalbToggleSecretChat()">Secret Mode OFF</button><label class="muted" style="display:flex;align-items:center;gap:6px"><input id="kalbSecretAutoCheck" type="checkbox" checked style="width:auto;margin:0"> Auto secret when timer is on</label></div><div id="kalbSecretNote" class="kalb-secret-note">Choose a disappearing timer or turn on Secret Mode for this chat.</div>`;
  top.appendChild(card); syncSecretControls();
}

async function markLastSentMessageExpiring(textBefore){
  const seconds=getDisappearSeconds(); const id=chatId(); const u=me(); if(!seconds||!id||!u)return;
  try{
    await new Promise(r=>setTimeout(r,650));
    const snap=await getDocs(query(collection(db,'chats',id,'messages'),orderBy('createdAt','desc'),limit(10)));
    let target=null;
    snap.forEach(d=>{ if(target)return; const m=d.data()||{}; if((m.senderUid||m.uid)===u.uid && !m.expiresAt && (!textBefore || String(m.text||'')===String(textBefore||''))) target={id:d.id,data:m}; });
    if(!target){snap.forEach(d=>{ if(target)return; const m=d.data()||{}; if((m.senderUid||m.uid)===u.uid && !m.expiresAt) target={id:d.id,data:m}; });}
    if(target){await updateDoc(doc(db,'chats',id,'messages',target.id),{expiresAt:Date.now()+seconds*1000,disappearSeconds:seconds,secretMode:isSecretOn(),updatedAt:serverTimestamp()});}
  }catch(e){console.warn('Disappearing message mark skipped',e);}
}
function findMsgIdFromElement(el){
  const buttons=Array.from(el.querySelectorAll('button[onclick]'));
  const btn=buttons.find(b=>/Message\("[^"]+"\)/.test(b.getAttribute('onclick')||''));
  let s=btn?.getAttribute('onclick')||'';
  let m=s.match(/Message\("([^"]+)"\)/);
  return m?m[1]:'';
}
async function cleanupAndDecorateMessages(){
  const id=chatId(); const box=document.getElementById('messagesBox'); if(!id||!box||!window._lastMessages)return;
  const now=Date.now();
  for(const el of box.querySelectorAll('.msg')){
    const mid=findMsgIdFromElement(el); if(!mid)continue;
    const m=window._lastMessages[mid]; if(!m)continue;
    const exp=Number(m.expiresAt||0);
    if(exp>0){
      const left=Math.max(0,Math.ceil((exp-now)/1000));
      if(left<=0){
        el.style.display='none';
        try{await deleteDoc(doc(db,'chats',id,'messages',mid));}catch(e){}
        continue;
      }
      if(!el.querySelector('.kalb-expire-pill')){
        const pill=document.createElement('span'); pill.className='kalb-expire-pill'; pill.textContent='⏳ '+(left<60?left+'s':Math.ceil(left/60)+'m');
        el.querySelector('.muted')?.appendChild(pill);
      }else{
        el.querySelector('.kalb-expire-pill').textContent='⏳ '+(left<60?left+'s':Math.ceil(left/60)+'m');
      }
    }
    if(m.secretMode && !el.querySelector('.kalb-secret-msg-pill')){
      const pill=document.createElement('span'); pill.className='kalb-expire-pill kalb-secret-msg-pill'; pill.textContent='🔒 Secret';
      el.querySelector('.muted')?.appendChild(pill);
    }
  }
}
function watchMessageBox(){
  const box=document.getElementById('messagesBox'); if(!box||box.__kalbSecretObserved)return;
  box.__kalbSecretObserved=true;
  const mo=new MutationObserver(()=>setTimeout(cleanupAndDecorateMessages,80));
  mo.observe(box,{childList:true,subtree:true});
}
function wrapChatFunctions(){
  if(!window.__kalbSecretOpenWrapped && typeof window.openPrivateChat==='function'){
    window.__kalbSecretOpenWrapped=true;
    const old=window.openPrivateChat;
    window.openPrivateChat=function(uid){ window.__kalbCurrentChatUid=String(uid||''); const r=old.apply(this,arguments); setTimeout(()=>{injectSecretChatControls();syncSecretControls();watchMessageBox();cleanupAndDecorateMessages();},250); setTimeout(()=>{syncSecretControls();cleanupAndDecorateMessages();},900); return r; };
  }
  if(!window.__kalbSecretSendWrapped && typeof window.sendPrivateChat==='function'){
    window.__kalbSecretSendWrapped=true;
    const old=window.sendPrivateChat;
    window.sendPrivateChat=async function(){ const input=document.getElementById('messageInput'); const textBefore=(input?.value||'').trim(); const r=await old.apply(this,arguments); if(textBefore)markLastSentMessageExpiring(textBefore); return r; };
  }
  if(!window.__kalbSecretOpenPageWrapped && typeof window.openPage==='function'){
    window.__kalbSecretOpenPageWrapped=true;
    const old=window.openPage;
    window.openPage=function(id,nav){ const r=old.apply(this,arguments); if(id==='themePage')setTimeout(injectThemeMarketplace,80); if(id==='chatRoomPage')setTimeout(()=>{injectSecretChatControls();syncSecretControls();watchMessageBox();cleanupAndDecorateMessages();},150); return r; };
  }
}
function boot(){injectThemeMarketplace(); if(activeTheme())applyMarketplaceTheme(activeTheme()); wrapChatFunctions(); setInterval(()=>{try{cleanupAndDecorateMessages();}catch(e){}},3000);}
document.addEventListener('DOMContentLoaded',boot);
setTimeout(boot,800); setTimeout(boot,2000);
onAuthStateChanged(auth,u=>{kalbThemeUser=u; setTimeout(()=>{injectThemeMarketplace();syncSecretControls();},500);});
