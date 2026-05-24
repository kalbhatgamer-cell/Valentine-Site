
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, where, deleteDoc, writeBatch, getDocs, arrayUnion, arrayRemove} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",
  authDomain: "kalb-message.firebaseapp.com",
  projectId: "kalb-message",
  storageBucket: "kalb-message.firebasestorage.app",
  messagingSenderId: "139873273901",
  appId: "1:139873273901:web:c7c079d385daeb3401d0a4",
  measurementId: "G-C9S0K1SG0D"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});}

let currentUser = null;
let allUsers = [];
let onlineMap = {};
let currentChatId = "";
let currentChatUser = null;
let unsubscribeMessages = null;
let unsubscribeTyping = null;
let unsubscribeChats = null;
let unsubscribePosts = null;
let typingTimer = null;
let allActivities=[];
let allPosts = [];
let feedFilter = 'new';
let chatFilter = 'all';
let profileAvatarEmoji = '😀';
let profileAvatarColor = 'purpleBlue';
let allGroups = [];
let allReports = [];
let allAnnouncements = [];
const ADMIN_EMAIL = 'kalbhatgamer@gmail.com';
let currentGroupId = '';
let currentGroup = null;
let unsubscribeGroups = null;
let unsubscribeGroupMessages = null;
let callTimerInterval = null;
let callStartTime = null;
let currentReply = null;
let unreadTotal = 0;
let currentUserProfile = null;
let viewedProfileUser = null;
let unsubscribeCallRequests = null;
let unsubscribeOutgoingCalls = null;

let pc = null;
let localStream = null;
let remoteStream = null;
let currentRoomRef = null;
let currentRoomId = "";
let callUnsubs = [];
const rtcServers = { iceServers: [{ urls: ["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun2.l.google.com:19302"] }] };

/* KALB CALL AUDIO FIX: keep mic enabled and always attach remote sound to a real audio output */
let remoteAudioEl = null;
function ensureRemoteAudioEl(){
  remoteAudioEl = document.getElementById("kalbRemoteAudio");
  if(!remoteAudioEl){
    remoteAudioEl = document.createElement("audio");
    remoteAudioEl.id = "kalbRemoteAudio";
    remoteAudioEl.autoplay = true;
    remoteAudioEl.playsInline = true;
    remoteAudioEl.setAttribute("playsinline","");
    remoteAudioEl.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(remoteAudioEl);
  }
  remoteAudioEl.muted = false;
  remoteAudioEl.volume = 1;
  return remoteAudioEl;
}
function keepLocalMicLive(){
  if(localStream){
    localStream.getAudioTracks().forEach(t=>{ t.enabled = true; });
  }
  const mb = document.getElementById("muteBtn");
  if(mb) mb.innerText = "🎙️ Mute Mic";
}
function attachRemoteOutput(stream){
  if(!stream) return;
  remoteStream = stream;
  const rv = document.getElementById("remoteVideo");
  const ra = ensureRemoteAudioEl();
  [rv,ra].forEach(el=>{
    if(!el) return;
    if(el.srcObject !== stream) el.srcObject = stream;
    el.autoplay = true;
    el.playsInline = true;
    el.muted = false;
    el.volume = 1;
  });
}
function playRemoteOutput(){
  const rv = document.getElementById("remoteVideo");
  const ra = ensureRemoteAudioEl();
  if(remoteStream){
    attachRemoteOutput(remoteStream);
  }
  const jobs=[];
  if(rv){ rv.muted=false; rv.volume=1; jobs.push(rv.play().catch(()=>{})); }
  if(ra){ ra.muted=false; ra.volume=1; jobs.push(ra.play().catch(()=>{})); }
  return Promise.all(jobs);
}
document.addEventListener("click",()=>{ if(remoteStream) playRemoteOutput(); }, true);
document.addEventListener("touchstart",()=>{ if(remoteStream) playRemoteOutput(); }, {capture:true,passive:true});


function showStatus(id,text,error=false){
  const el=document.getElementById(id);
  if(el) el.innerHTML='<div class="notice '+(error?'err':'')+'">'+safe(text)+'</div>';
}
function safe(value){
  return String(value||"").replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]});
}
function initials(name,email){return String(name||email||"User").trim().charAt(0).toUpperCase()}
function chatIdFor(a,b){return [a,b].sort().join("_")}
function formatTime(ts){try{return ts&&ts.toDate?ts.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}catch(e){return ""}}
function formatDate(ts){try{return ts&&ts.toDate?ts.toDate().toLocaleString():""}catch(e){return ""}}
function lastSeenText(uid){
  const data = onlineMap[uid];
  if(data && data.online === true) return "Online";
  if(data && data.lastSeen && data.lastSeen.toDate) return "Last seen " + data.lastSeen.toDate().toLocaleString();
  return "Offline";
}



function avatarStyle(color){
  const map={
    purpleBlue:"linear-gradient(135deg,#8b5cf6,#06b6d4)",
    greenCyan:"linear-gradient(135deg,#22c55e,#06b6d4)",
    orangeRed:"linear-gradient(135deg,#f97316,#ef4444)",
    pinkPurple:"linear-gradient(135deg,#ec4899,#8b5cf6)",
    yellowGreen:"linear-gradient(135deg,#facc15,#22c55e)"
  };
  return map[color] || map.purpleBlue;
}
function getChatMeta(chatId){
  const data=JSON.parse(localStorage.getItem("kalbChatMeta")||"{}");
  return data[chatId]||{};
}
function setChatMeta(chatId,patch){
  const data=JSON.parse(localStorage.getItem("kalbChatMeta")||"{}");
  data[chatId]={...(data[chatId]||{}),...patch};
  localStorage.setItem("kalbChatMeta",JSON.stringify(data));
}

async function isCurrentUserBanned(){
  if(!currentUser) return true;
  try{
    const snap = await getDoc(doc(db,"users",currentUser.uid));
    return snap.exists() && snap.data().banned === true;
  }catch(e){
    console.error(e);
    return false;
  }
}

async function ensureUserDoc(user){
  const ref=doc(db,"users",user.uid);
  const snap=await getDoc(ref);
  if(!snap.exists()){
    const username=(user.email||"user").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g,"");
    await setDoc(ref,{uid:user.uid,name:user.displayName||username||"User",username,email:user.email||"",bio:"Hey there, I am using Kalb Message.",avatarEmoji:"😀",avatarColor:"purpleBlue",following:[],followers:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp(),kalbCoins:0,ownedRewards:[]});
  }
}
async function setOnline(isOnline){
  if(!currentUser) return;
  await setDoc(doc(db,"onlineUsers",currentUser.uid),{uid:currentUser.uid,email:currentUser.email||"",online:isOnline,lastSeen:serverTimestamp()},{merge:true});
}

window.googleLogin=async function(){
  try{showStatus("authStatus","Opening Google login...");const r=await signInWithPopup(auth,provider);showStatus("authStatus","Login successful: "+(r.user.email||"Google user"))}
  catch(e){console.error(e);showStatus("authStatus",(e.code?e.code+": ":"")+e.message,true)}
}
window.emailSignup=async function(){
  try{
    const email=authEmail.value.trim(),pass=authPassword.value.trim();
    if(!email||!pass)return showStatus("authStatus","Enter email and password.",true);
    if(pass.length<6)return showStatus("authStatus","Password must be at least 6 characters.",true);
    showStatus("authStatus","Creating account...");
    const r=await createUserWithEmailAndPassword(auth,email,pass);
    showStatus("authStatus","Account created: "+(r.user.email||email));
  }catch(e){console.error(e);showStatus("authStatus",(e.code?e.code+": ":"")+e.message,true)}
}
window.emailLogin=async function(){
  try{
    const email=authEmail.value.trim(),pass=authPassword.value.trim();
    if(!email||!pass)return showStatus("authStatus","Enter email and password.",true);
    showStatus("authStatus","Logging in...");
    const r=await signInWithEmailAndPassword(auth,email,pass);
    showStatus("authStatus","Login successful: "+(r.user.email||email));
  }catch(e){console.error(e);showStatus("authStatus",(e.code?e.code+": ":"")+e.message,true)}
}


/* ACCOUNT SWITCHER SAFE ADDON - no old feature changes */
const KALB_ACCOUNT_SWITCHER_KEY = "kalbSavedAccountsV1";
function accountSwitcherGetSaved(){
  try{ return JSON.parse(localStorage.getItem(KALB_ACCOUNT_SWITCHER_KEY)||"[]").filter(Boolean); }
  catch(e){ return []; }
}
function accountSwitcherSetSaved(list){
  try{ localStorage.setItem(KALB_ACCOUNT_SWITCHER_KEY, JSON.stringify(list||[])); }catch(e){}
}

function accountSwitcherEscape(v){
  return String(v==null?"":v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function accountSwitcherInitial(user){
  const name=(user && (user.displayName || user.email || "U")) || "U";
  return String(name).trim().charAt(0).toUpperCase() || "U";
}
function accountSwitcherStatus(msg,isErr){
  const box=document.getElementById("accountSwitcherStatus");
  if(box) box.innerHTML = `<div class="notice ${isErr?'err':''}">${msg}</div>`;
}
function accountSwitcherSaveUser(user, providerHint){
  if(!user) return;
  const uid=user.uid;
  const list=accountSwitcherGetSaved();
  const existing=list.find(a=>a.uid===uid || (user.email && a.email===user.email));
  const provider=(providerHint || (user.providerData && user.providerData[0] && user.providerData[0].providerId) || "password");
  const item={
    uid,
    email:user.email||"",
    name:user.displayName||user.email||"User",
    photoURL:user.photoURL||"",
    provider,
    savedAt:Date.now()
  };
  if(existing) Object.assign(existing,item); else list.unshift(item);
  accountSwitcherSetSaved(list.slice(0,10));
  renderAccountSwitcher();
}
window.saveCurrentAccountForSwitch=function(){
  if(!auth.currentUser) return accountSwitcherStatus("Login first, then save this account.",true);
  accountSwitcherSaveUser(auth.currentUser);
  accountSwitcherStatus("Current account saved on this device.",false);
};
window.addGoogleAccountForSwitch=async function(){
  try{
    accountSwitcherStatus("Opening Google account picker...");
    if(provider && provider.setCustomParameters) provider.setCustomParameters({prompt:"select_account"});
    const r=await signInWithPopup(auth,provider);
    accountSwitcherSaveUser(r.user,"google.com");
    accountSwitcherStatus("Google account added and switched successfully.",false);
  }catch(e){ console.error(e); accountSwitcherStatus((e.code?e.code+": ":"")+e.message,true); }
};
window.addEmailAccountForSwitch=async function(){
  const email=prompt("Enter the email account you want to add/switch:");
  if(!email) return;
  const pass=prompt("Enter password for "+email+":");
  if(!pass) return;
  try{
    accountSwitcherStatus("Signing in...");
    const r=await signInWithEmailAndPassword(auth,email.trim(),pass);
    accountSwitcherSaveUser(r.user,"password");
    accountSwitcherStatus("Email account added and switched successfully.",false);
  }catch(e){ console.error(e); accountSwitcherStatus((e.code?e.code+": ":"")+e.message,true); }
};
window.switchSavedAccount=async function(uid){
  const acc=accountSwitcherGetSaved().find(a=>a.uid===uid);
  if(!acc) return accountSwitcherStatus("Saved account not found.",true);
  if(auth.currentUser && auth.currentUser.uid===uid) return accountSwitcherStatus("This account is already active.",false);
  try{
    if((acc.provider||"").includes("google")){
      accountSwitcherStatus("Opening Google picker. Select: "+(acc.email||acc.name));
      if(provider && provider.setCustomParameters) provider.setCustomParameters({prompt:"select_account", login_hint:acc.email||""});
      const r=await signInWithPopup(auth,provider);
      accountSwitcherSaveUser(r.user,"google.com");
      accountSwitcherStatus("Switched account successfully.",false);
    }else{
      const pass=prompt("Enter password for "+(acc.email||acc.name)+" to switch:");
      if(!pass) return;
      const r=await signInWithEmailAndPassword(auth,acc.email,pass);
      accountSwitcherSaveUser(r.user,"password");
      accountSwitcherStatus("Switched account successfully.",false);
    }
  }catch(e){ console.error(e); accountSwitcherStatus((e.code?e.code+": ":"")+e.message,true); }
};
window.removeSavedAccount=function(uid){
  const list=accountSwitcherGetSaved().filter(a=>a.uid!==uid);
  accountSwitcherSetSaved(list);
  renderAccountSwitcher();
  accountSwitcherStatus("Account removed from this device only.",false);
};
window.renderAccountSwitcher=function(){
  const box=document.getElementById("accountSwitcherList");
  if(!box) return;
  const list=accountSwitcherGetSaved();
  if(!list.length){ box.innerHTML='<p class="muted">No saved accounts yet. Save your current account or add another account.</p>'; return; }
  const activeUid=auth.currentUser && auth.currentUser.uid;
  box.innerHTML=list.map(acc=>{
    const active=acc.uid===activeUid;
    const initial=String(acc.name||acc.email||"U").charAt(0).toUpperCase();
    return `<div class="account-item-row">
      <div class="account-mini-avatar">${initial}</div>
      <div><h3>${accountSwitcherEscape(acc.name||"User")}</h3><p>${accountSwitcherEscape(acc.email||"No email")}</p>${active?'<span class="account-current-pill">Current account</span>':''}</div>
      <div class="account-switch-actions">
        <button class="btn small" onclick="switchSavedAccount('${acc.uid}')">Switch</button>
        <button class="btn small red" onclick="removeSavedAccount('${acc.uid}')">Remove</button>
      </div>
    </div>`;
  }).join("");
};
setTimeout(renderAccountSwitcher,500);



/* KALB COINS JS + REWARDS STORE + LEADERBOARD */
const KALB_DAILY_REWARD = 25;
const KALB_REWARDS = [
  {id:"gold_frame", name:"Golden Profile Frame", price:100, icon:"🏆", desc:"Premium gold style reward for your profile."},
  {id:"name_glow", name:"Name Glow", price:150, icon:"✨", desc:"Special glowing name reward."},
  {id:"gaming_badge", name:"Gaming Reward Badge", price:80, icon:"🎮", desc:"Reward badge for active gamers."},
  {id:"amethyst_theme", name:"Amethyst Theme Pack", price:120, icon:"💜", desc:"Unlock a premium purple theme style."},
  {id:"vip_chat_bubble", name:"VIP Chat Bubble", price:180, icon:"💬", desc:"VIP style chat bubble reward."},
  {id:"creator_boost", name:"Creator Boost", price:220, icon:"🚀", desc:"Creator-style reward for your profile."}
];
function kalbCoinsNum(v){ const n=Number(v||0); return Number.isFinite(n)?Math.max(0,Math.floor(n)):0; }
function kalbOwnedRewards(u){ return Array.isArray(u?.ownedRewards)?u.ownedRewards:[]; }
function kalbTodayKey(){ return new Date().toISOString().slice(0,10); }
function kalbCoinsStatus(text,error=false){ const el=document.getElementById('kalbCoinsStatus'); if(el) el.innerHTML='<div class="notice '+(error?'err':'')+'">'+safe(text)+'</div>'; }
function kalbAdminCoinsStatus(text,error=false){ const el=document.getElementById('adminCoinsStatus'); if(el) el.innerHTML='<div class="notice '+(error?'err':'')+'">'+safe(text)+'</div>'; }
async function kalbEnsureCoinsFields(){
  if(!currentUser) return;
  try{
    const ref=doc(db,'users',currentUser.uid);
    const snap=await getDoc(ref);
    const data=snap.exists()?snap.data():(currentUserProfile||{});
    const patch={rewardsUpdatedAt:serverTimestamp()};
    if(typeof data.kalbCoins==='undefined') patch.kalbCoins=0;
    if(!Array.isArray(data.ownedRewards)) patch.ownedRewards=[];
    if(Object.keys(patch).length>1) await setDoc(ref,patch,{merge:true});
    currentUserProfile={...(currentUserProfile||{}),...data,...patch};
  }catch(e){ console.warn('Coins field save skipped',e); }
}
window.kalbRenderCoinsSystem=function(){
  const u=currentUserProfile||{};
  const coins=kalbCoinsNum(u.kalbCoins);
  const owned=kalbOwnedRewards(u);
  const balance=document.getElementById('kalbCoinBalance'); if(balance) balance.innerText=coins;
  const pc=document.getElementById('profileCoinsCount'); if(pc) pc.innerText=coins;
  const ownCount=document.getElementById('kalbOwnedRewardsCount'); if(ownCount) ownCount.innerText=owned.length;
  const daily=document.getElementById('kalbDailyRewardAmount'); if(daily) daily.innerText='+'+KALB_DAILY_REWARD;
  const store=document.getElementById('kalbRewardsStore');
  if(store){
    store.innerHTML=KALB_REWARDS.map(item=>{
      const has=owned.includes(item.id);
      return `<div class="kalb-reward-card ${has?'kalb-reward-owned':''}">
        <h4>${item.icon} ${safe(item.name)}</h4>
        <p>${safe(item.desc)}</p>
        <span class="kalb-reward-price">${item.price} 🪙</span>
        <button class="btn small ${has?'green':''}" onclick="kalbBuyReward('${item.id}')">${has?'Owned':'Buy'}</button>
      </div>`;
    }).join('');
  }
  window.kalbRenderCoinsLeaderboard();
  window.kalbRenderCoinsAdmin();
};
window.kalbRenderCoinsLeaderboard=function(){
  const box=document.getElementById('kalbCoinsLeaderboard');
  const rankBox=document.getElementById('kalbLeaderboardRank');
  const full=(allUsers||[]).slice().sort((a,b)=>kalbCoinsNum(b.kalbCoins)-kalbCoinsNum(a.kalbCoins));
  const list=full.slice(0,10);
  const myIndex=full.findIndex(u=>u.uid===currentUser?.uid);
  if(rankBox) rankBox.innerText=myIndex>=0?'#'+(myIndex+1):'—';
  if(!box) return;
  box.innerHTML=list.length?list.map((u,i)=>`<div class="kalb-leader-row">
    <div class="kalb-rank">${i+1}</div>
    <div><h4>${safe(u.name||'User')}</h4><p>@${safe(u.username||'user')}</p></div>
    <div class="kalb-leader-coins">${kalbCoinsNum(u.kalbCoins)} 🪙</div>
  </div>`).join(''):'<div class="empty">Leaderboard will show when users earn coins.</div>';
};
window.kalbClaimDailyCoins=async function(){
  if(!currentUser) return alert('Login first.');
  const today=kalbTodayKey();
  const old=currentUserProfile||{};
  if(old.lastCoinClaimDate===today) return kalbCoinsStatus('You already claimed today. Come back tomorrow.',true);
  const next=kalbCoinsNum(old.kalbCoins)+KALB_DAILY_REWARD;
  try{
    await setDoc(doc(db,'users',currentUser.uid),{kalbCoins:next,lastCoinClaimDate:today,coinsUpdatedAt:serverTimestamp()},{merge:true});
    currentUserProfile={...old,kalbCoins:next,lastCoinClaimDate:today};
    kalbCoinsStatus('Daily reward claimed: +'+KALB_DAILY_REWARD+' coins.');
    window.kalbRenderCoinsSystem();
    if(typeof createActivity==='function') createActivity('coins','claimed daily Kalb Coins','',{amount:KALB_DAILY_REWARD});
  }catch(e){ console.error(e); kalbCoinsStatus(e.message||'Could not claim coins.',true); }
};
window.kalbBuyReward=async function(id){
  if(!currentUser) return alert('Login first.');
  const item=KALB_REWARDS.find(x=>x.id===id); if(!item) return;
  const old=currentUserProfile||{};
  const owned=kalbOwnedRewards(old);
  if(owned.includes(id)) return kalbCoinsStatus(item.name+' is already owned.');
  const coins=kalbCoinsNum(old.kalbCoins);
  if(coins<item.price) return kalbCoinsStatus('Not enough Kalb Coins for '+item.name+'.',true);
  const nextCoins=coins-item.price;
  const nextOwned=[...owned,id];
  try{
    await setDoc(doc(db,'users',currentUser.uid),{kalbCoins:nextCoins,ownedRewards:nextOwned,coinsUpdatedAt:serverTimestamp()},{merge:true});
    currentUserProfile={...old,kalbCoins:nextCoins,ownedRewards:nextOwned};
    kalbCoinsStatus('Purchased: '+item.name+'.');
    window.kalbRenderCoinsSystem();
    if(typeof createActivity==='function') createActivity('reward','purchased '+item.name,'',{reward:id});
  }catch(e){ console.error(e); kalbCoinsStatus(e.message||'Purchase failed.',true); }
};
window.kalbRenderCoinsAdmin=function(){
  const card=document.getElementById('adminCoinsControlsCard');
  if(card) card.classList.toggle('hidden', !(typeof isAppAdmin==='function' && isAppAdmin()));
  const sel=document.getElementById('adminCoinsUserSelect'); if(!sel) return;
  const old=sel.value;
  sel.innerHTML='<option value="">Select user</option>'+((allUsers||[]).map(u=>`<option value="${u.uid}">${safe(u.name||'User')} — ${kalbCoinsNum(u.kalbCoins)} coins</option>`).join(''));
  if(old) sel.value=old;
};
window.adminAddKalbCoins=async function(){
  if(!(typeof isAppAdmin==='function' && isAppAdmin())) return alert('Admin only.');
  const uid=document.getElementById('adminCoinsUserSelect')?.value||'';
  const amount=Math.max(1,Number(document.getElementById('adminCoinsAmount')?.value||0));
  if(!uid) return kalbAdminCoinsStatus('Select a user first.',true);
  const u=(allUsers||[]).find(x=>x.uid===uid)||{};
  const next=kalbCoinsNum(u.kalbCoins)+amount;
  try{ await setDoc(doc(db,'users',uid),{kalbCoins:next,coinsUpdatedAt:serverTimestamp()},{merge:true}); kalbAdminCoinsStatus('Added '+amount+' coins.'); }catch(e){ console.error(e); kalbAdminCoinsStatus(e.message||'Failed.',true); }
};
window.adminRemoveKalbCoins=async function(){
  if(!(typeof isAppAdmin==='function' && isAppAdmin())) return alert('Admin only.');
  const uid=document.getElementById('adminCoinsUserSelect')?.value||'';
  const amount=Math.max(1,Number(document.getElementById('adminCoinsAmount')?.value||0));
  if(!uid) return kalbAdminCoinsStatus('Select a user first.',true);
  const u=(allUsers||[]).find(x=>x.uid===uid)||{};
  const next=Math.max(0,kalbCoinsNum(u.kalbCoins)-amount);
  try{ await setDoc(doc(db,'users',uid),{kalbCoins:next,coinsUpdatedAt:serverTimestamp()},{merge:true}); kalbAdminCoinsStatus('Removed '+amount+' coins.'); }catch(e){ console.error(e); kalbAdminCoinsStatus(e.message||'Failed.',true); }
};
window.kalbInitCoinsSystem=async function(){
  if(!currentUser) return;
  await kalbEnsureCoinsFields();
  window.kalbRenderCoinsSystem();
};
setTimeout(()=>{try{window.kalbRenderCoinsSystem&&window.kalbRenderCoinsSystem()}catch(e){}},1200);


window.logout=async function(){
  try{await setOnline(false);await signOut(auth)}
  catch(e){alert(e.message)}
}

onAuthStateChanged(auth,async function(user){
  currentUser=user;
  try{ if(user) accountSwitcherSaveUser(user); else renderAccountSwitcher(); }catch(e){console.warn("account switcher render",e)}
  if(user){
    openLoggedInApp();
    homeUser.innerText="Logged in as "+(user.email||"User");
    try{await ensureUserDoc(user)}catch(e){console.error("User profile failed:",e)}
    try{
      const meSnap = await getDoc(doc(db,"users",user.uid));
      if(meSnap.exists() && meSnap.data().banned === true){
        alert("Your account is banned by admin.");
        await signOut(auth);
        return;
      }
    }catch(e){console.error("Ban check failed:",e)}
    try{await setOnline(true)}catch(e){console.error("Online failed:",e)}
    try{listenUsers()}catch(e){console.error(e)}
    try{listenOnlineUsers()}catch(e){console.error(e)}
    try{listenChats()}catch(e){console.error(e)}
    try{listenPosts()}catch(e){console.error(e)}
    try{listenActivities()}catch(e){console.error(e)}
    try{applySavedSettings()}catch(e){console.error(e)}
    try{listenGroups()}catch(e){console.error(e)}
    try{listenReports()}catch(e){console.error(e)}
    try{listenAnnouncements()}catch(e){console.error(e)}
    try{listenCallRequests()}catch(e){console.error(e)}
    const adminAllowed = (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
    document.querySelectorAll(".admin-nav").forEach(n=>n.classList.toggle("hidden", !adminAllowed));
    const pab = document.getElementById("profileAdminBtn");
    if(pab) pab.classList.toggle("hidden", !adminAllowed);
    try{loadProfile()}catch(e){console.error(e)}
    try{kalbInitCoinsSystem()}catch(e){console.error(e)}
  }else{
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    authPage.classList.add("active");
    bottomNav.style.display="none";
    document.querySelectorAll(".admin-nav").forEach(n=>n.classList.add("hidden"));
    const pab = document.getElementById("profileAdminBtn");
    if(pab) pab.classList.add("hidden");
  }
});
window.addEventListener("beforeunload",function(){if(currentUser)setOnline(false)});

function openLoggedInApp(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  homePage.classList.add("active");
  bottomNav.style.display="flex";
  document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));
  document.querySelector(".nav").classList.add("active");
}

function isAppAdmin(){return currentUser && (currentUser.email||'').toLowerCase()==='kalbhatgamer@gmail.com'}
async function createActivity(type,text,targetUid='',extra={}){if(!currentUser)return;try{await addDoc(collection(db,'activities'),{type,text,uid:currentUser.uid,targetUid:targetUid||'',actorName:currentUserProfile?.name||currentUser.displayName||'User',actorEmail:currentUser.email||'',extra,createdAt:serverTimestamp()})}catch(e){console.warn('activity failed',e)}}
function listenActivities(){if(!currentUser)return;const q=query(collection(db,'activities'),orderBy('createdAt','desc'));onSnapshot(q,function(snapshot){allActivities=[];snapshot.forEach(d=>allActivities.push({id:d.id,...d.data()}));renderActivity()},console.error)}
function renderActivity(){const box=document.getElementById('activityList');if(!box)return;const visible=(allActivities||[]).filter(a=>!a.targetUid||a.targetUid===currentUser?.uid||a.uid===currentUser?.uid||a.type==='announcement');box.innerHTML=visible.length?visible.slice(0,80).map(a=>`<div class="activity-item"><b>${safe(a.actorName||'Kalb')}</b><p>${safe(a.text||'New activity')}</p><p class="muted">${formatDate(a.createdAt)}</p></div>`).join(''):'<div class="empty">No activity yet.</div>'}
window.setFeedFilter=function(type){feedFilter=type||'newest';renderPosts()};
window.createStoryPost=async function(){if(!currentUser)return alert('Login first.');const box=document.getElementById('homePostText')||document.getElementById('postText');const text=(box?.value||'').trim();if(!text)return alert('Write something first.');const me=currentUserProfile||{};await addDoc(collection(db,'posts'),{text,type:'story',uid:currentUser.uid,email:currentUser.email||'',name:me.name||currentUser.displayName||'User',username:me.username||'user',likes:[],savedBy:[],commentsCount:0,pinned:false,repostOf:'',createdAt:serverTimestamp()});box.value='';await createActivity('story','posted a new story/status','')};
window.repostPost=async function(postId){const p=(allPosts||[]).find(x=>x.id===postId);if(!p||!currentUser)return;const me=currentUserProfile||{};await addDoc(collection(db,'posts'),{text:'Repost: '+(p.text||''),type:'repost',uid:currentUser.uid,email:currentUser.email||'',name:me.name||currentUser.displayName||'User',username:me.username||'user',likes:[],savedBy:[],commentsCount:0,pinned:false,repostOf:postId,createdAt:serverTimestamp()});await createActivity('repost','reposted your post',p.uid||'')};
window.pinPost=async function(postId){const p=(allPosts||[]).find(x=>x.id===postId);if(!p||p.uid!==currentUser?.uid)return alert('You can pin only your own post.');await updateDoc(doc(db,'posts',postId),{pinned:!p.pinned})};
window.runGlobalSearch=function(){const q=(globalSearchInput.value||'').toLowerCase().trim();const box=document.getElementById('globalSearchResults');if(!box)return;if(!q){box.innerHTML='<div class="empty">Search something...</div>';return}const users=(allUsers||[]).filter(u=>((u.name||'')+' '+(u.username||'')+' '+(u.email||'')).toLowerCase().includes(q)).slice(0,10).map(u=>`<div class="search-result"><b>User: ${safe(u.name||'User')}</b><p>@${safe(u.username||'user')} • ${safe(u.email||'')}</p><button class="btn small" onclick='viewUserProfile("${u.uid}")'>View Profile</button></div>`);const posts=(allPosts||[]).filter(p=>String(p.text||'').toLowerCase().includes(q)).slice(0,10).map(p=>`<div class="search-result"><b>Post by ${safe(p.name||'User')}</b><p>${safe(p.text||'')}</p></div>`);const groups=(allGroups||[]).filter(g=>((g.name||'')+' '+(g.description||'')).toLowerCase().includes(q)).slice(0,10).map(g=>`<div class="search-result"><b>Group: ${safe(g.name||'Group')}</b><p>${safe(g.description||'')}</p></div>`);box.innerHTML=[...users,...posts,...groups].join('')||'<div class="empty">No result found.</div>'};
window.setAppTheme=function(mode){localStorage.setItem('kalbTheme',mode);document.body.classList.toggle('light-mode',mode==='light')};
window.setAccent=function(color,color2){
  const second=color2||color;
  localStorage.setItem("kalbAccent",color);
  localStorage.setItem("kalbAccent2",second);
  document.documentElement.style.setProperty("--accent",color);
  document.documentElement.style.setProperty("--accent2",second);
  document.querySelectorAll(".btn:not(.red):not(.green),.auth-btn,.link-btn").forEach(b=>{
    b.style.background=`linear-gradient(135deg, ${color}, ${second})`;
    b.style.boxShadow=`0 0 18px ${color}55`;
  });
  document.querySelectorAll(".card h2,.card h3,.user-info h3").forEach(e=>e.style.color=color);
};
function applySavedSettings(){
  const mode=localStorage.getItem("kalbTheme")||"dark";
  document.body.classList.toggle("light-mode",mode==="light");
  const accent=localStorage.getItem("kalbAccent")||"#67e8f9";
  const accent2=localStorage.getItem("kalbAccent2")||"#a78bfa";
  setAccent(accent,accent2);
}


function canShowOnlineForUser(u){
  return !(u && u.hideOnline === true);
}

function getPrivacyAwareLastSeen(u){
  if(!u)return "";
  if(u.hideOnline===true)return "Online hidden";
  return lastSeenText(u.uid);
}

window.toggleOnlinePrivacy=async function(){
  if(!currentUser)return alert("Login first.");
  const next = !(currentUserProfile && currentUserProfile.hideOnline === true);
  await setDoc(doc(db,"users",currentUser.uid),{
    hideOnline:next,
    updatedAt:serverTimestamp()
  },{merge:true});
  currentUserProfile={...(currentUserProfile||{}),hideOnline:next};
  if(document.getElementById("privacyBtn")){
    privacyBtn.innerText=next?"Show Online Status":"Hide Online Status";
  }
  renderUsers();
  if(typeof renderChatListCache==="function")renderChatListCache();
  if(viewedProfileUser && viewedProfileUser.uid===currentUser.uid){
    viewedProfileUser={...viewedProfileUser,hideOnline:next};
  }
  alert(next?"Your online status is now hidden.":"Your online status is now visible.");
};

window.adminSendAnnouncement=async function(){if(!isAppAdmin())return alert('Only admin can send announcement.');const text=(adminAnnouncementText.value||'').trim();if(!text)return alert('Write announcement.');await addDoc(collection(db,'announcements'),{text,uid:currentUser.uid,email:currentUser.email,createdAt:serverTimestamp()});await createActivity('announcement',text,'',{admin:true});adminAnnouncementText.value='';alert('Announcement sent')};
function renderAdminExtra(){if(document.getElementById('adminStatsText'))adminStatsText.innerText=`Users: ${(allUsers||[]).length} • Posts: ${(allPosts||[]).length} • Groups: ${(allGroups||[]).length}`}

window.openPage=function(id,navEl){
  if(id==='chatListPage') id='chatsPage';
  if(!currentUser&&id!=="authPage")return alert("Please login first.");
  if((id==="adminToolsPage"||id==="adminPage")&&!isAppAdmin())return alert("Only admin can open Admin Tools.");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const pg=document.getElementById(id);if(pg)pg.classList.add("active");
  if(navEl){document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));navEl.classList.add("active")}
  if(id==="profilePage")loadProfile();
  if(id==="friendsPage"){try{renderFriendsList()}catch(e){}}
  if(id==="usersPage"||id==="searchPage"||id==="requestsPage"){try{renderFriendRequests()}catch(e){};try{renderUsers()}catch(e){}}
  if(id==="feedPage")renderPosts();
  if(id==="groupsPage")renderGroups();
  if(id==="createGroupPage")renderGroupMemberPicker();
  if(id==="callsPage"){renderCallHistory();renderCallUsersList();}
  if(id==="activityPage")renderActivity();
  if(id==="adminPage")renderAdminPanel();
  if(id==="adminToolsPage")renderAdminExtra();
  if(id==="themesPage"&&typeof applySavedTheme==="function")applySavedTheme();
};

function listenUsers(){
  onSnapshot(collection(db,"users"),function(snapshot){
    allUsers=[];
    snapshot.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
    if(currentUser){
      const fresh=allUsers.find(u=>u.uid===currentUser.uid);
      if(fresh){currentUserProfile=fresh; loadProfile();}
    }
    if(document.getElementById("totalUsers"))totalUsers.innerText=allUsers.length;
    renderUsers();
    renderChatListCache();
    renderPosts();
    if(typeof kalbRenderCoinsSystem==="function")kalbRenderCoinsSystem();
    if(typeof kalbRenderCoinsAdmin==="function")kalbRenderCoinsAdmin();
  },function(error){
    console.error(error);
    if(document.getElementById("usersList"))usersList.innerHTML='<div class="card"><p class="muted">Users could not load. Check Firestore rules.</p></div>';
  });
}
function listenOnlineUsers(){
  onSnapshot(collection(db,"onlineUsers"),function(snapshot){
    onlineMap={};let count=0;
    snapshot.forEach(function(d){
      const data=d.data();
      onlineMap[data.uid]={online:data.online===true,lastSeen:data.lastSeen};
      if(data.online===true)count++;
    });
    onlineUsersCount.innerText=count;
    renderUsers();
  });
}


/* FINAL USER NAME URL CLEAN FIX */
function isBadProfileNameFinal(v){
  v = String(v || '').trim();
  if(!v) return true;
  if(/^https?:\/\//i.test(v)) return true;
  if(/googleusercontent\.com|lh3\.googleusercontent\.com|googleapis\.com/i.test(v)) return true;
  if(/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(v)) return true;
  if(v.length > 38 && /[A-Za-z0-9_-]{25,}/.test(v)) return true;
  return false;
}
function cleanProfileNameFinal(u, fallback){
  u = u || {};
  const list = [u.name, u.displayName, u.fullName, u.username, u.emailName];
  for(const x of list){
    const s = String(x || '').trim();
    if(!isBadProfileNameFinal(s)) return s.slice(0,32);
  }
  const em = String(u.email || '').trim();
  if(em && em.includes('@')) return em.split('@')[0].slice(0,32);
  const un = String(u.username || '').trim();
  if(un && !isBadProfileNameFinal(un)) return un.slice(0,32);
  return fallback || 'User';
}
function cleanUserRowNameFinal(u){ return cleanProfileNameFinal(u, 'User'); }
function scrubBadVisibleNamesFinal(root=document){
  try{
    root.querySelectorAll('.user-card strong,.feed-card strong,.chat-title,.profile-name,.name,.user-name,[data-username]').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(isBadProfileNameFinal(t)){
        const card=el.closest('[data-email],[data-uid],.user-card,.feed-card,.chat-row,.friend-card');
        const email=(card?.getAttribute('data-email')||'').trim();
        el.textContent = email && email.includes('@') ? email.split('@')[0] : 'User';
        el.style.overflow='hidden'; el.style.textOverflow='ellipsis'; el.style.maxWidth='100%';
      }
    });
  }catch(e){}
}
setInterval(()=>scrubBadVisibleNamesFinal(),1200);
try{let kalbScrubTimer=null;new MutationObserver(()=>{clearTimeout(kalbScrubTimer);kalbScrubTimer=setTimeout(()=>scrubBadVisibleNamesFinal(),300);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});}catch(e){}

function renderUsers(){
  const box=document.getElementById("usersList")||document.getElementById("usersBox")||document.getElementById("findUsersBox");
  if(!box)return;
  const qtxt=(document.getElementById("userSearchInput")?.value||document.querySelector('input[placeholder*="Search users"]')?.value||"").toLowerCase();
  let list=(allUsers||[]).filter(u=>u.uid!==currentUser?.uid);
  list=list.filter(u=>!qtxt||(u.name||"").toLowerCase().includes(qtxt)||(u.username||"").toLowerCase().includes(qtxt)||(u.email||"").toLowerCase().includes(qtxt));
  if(!list.length){box.innerHTML='<div class="card empty">No users found.</div>';return;}
  box.innerHTML=list.map(u=>{
    const blocked=typeof isBlocked==="function"?isBlocked(u.uid):((currentUserProfile?.blockedUsers||[]).includes(u.uid));
    const friend=(currentUserProfile?.friends||[]).includes(u.uid);
    const v=u.verified?'<span class="badge-verified">✓</span>':'';
    const displayName=safe(cleanUserRowNameFinal(u));
    const uname=safe(u.username||((u.email||"user").split("@")[0])||"user");
    return `<div class="search-user-card user-row ${blocked?'blocked-user':''}">
      <div class="avatar">${safe(u.avatarEmoji||initials(u.name,u.email))}</div>
      <div class="user-info user-details"><h3 class="search-user-name">${displayName} ${v}</h3><p class="search-user-username">@${uname} ${friend?' • Friend':''}</p><p class="muted">${safe(u.bio||"")}</p></div>
      <div class="actions"><button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>${friend?`<button class="btn small red" onclick='unfriendUser("${u.uid}")'>Unfriend</button>`:`<button class="btn small" onclick='sendFriendRequest("${u.uid}")'>Add Friend</button>`}<button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>${blocked?`<button class="btn small" onclick='unblockUser("${u.uid}")'>Unblock</button>`:`<button class="btn small red" onclick='blockUser("${u.uid}")'>Block</button>`}<button class="btn small red" onclick='reportProfile("${u.uid}")'>Report</button></div>
    </div>`;
  }).join("");
}












window.toggleFollowUser=async function(uid){
  try{
    if(!currentUser)return alert("Please login first.");
    if(!uid)return alert("User not found.");
    if(uid===currentUser.uid)return alert("This is your own profile.");
    const myRef=doc(db,"users",currentUser.uid);
    const otherRef=doc(db,"users",uid);
    const mySnap=await getDoc(myRef);
    const otherSnap=await getDoc(otherRef);
    const me=mySnap.exists()?mySnap.data():{};
    const other=otherSnap.exists()?otherSnap.data():{};
    let myFollowing=Array.isArray(me.following)?me.following:[];
    let otherFollowers=Array.isArray(other.followers)?other.followers:[];
    const already=myFollowing.includes(uid)||otherFollowers.includes(currentUser.uid);
    if(already){
      myFollowing=myFollowing.filter(x=>x!==uid);
      otherFollowers=otherFollowers.filter(x=>x!==currentUser.uid);
    }else{
      myFollowing=Array.from(new Set([...myFollowing,uid]));
      otherFollowers=Array.from(new Set([...otherFollowers,currentUser.uid]));
    }
    await setDoc(myRef,{following:myFollowing,updatedAt:serverTimestamp()},{merge:true});
    await setDoc(otherRef,{followers:otherFollowers,updatedAt:serverTimestamp()},{merge:true});
    currentUserProfile={...(currentUserProfile||{}),following:myFollowing};
    if(viewedProfileUser && viewedProfileUser.uid===uid){
      viewedProfileUser={...viewedProfileUser,followers:otherFollowers};
      if(document.getElementById("viewFollowersCount"))viewFollowersCount.innerText=otherFollowers.length;
  if(!already) await createActivity("follow","followed you",viewedProfileUser.uid,{});
      updateViewedFollowButton();
    }
    await loadProfile();
    renderUsers();
    renderPosts();
    return !already;
  }catch(err){
    console.error("follow failed",err);
    alert("Follow failed: "+(err.message||err));
  }
};

function updateViewedFollowButton(){
  if(!viewedProfileUser || !currentUser || !document.getElementById("viewFollowBtn"))return;
  if(viewedProfileUser.uid===currentUser.uid){viewFollowBtn.classList.add("hidden");return;}
  viewFollowBtn.classList.remove("hidden");
  const followers=Array.isArray(viewedProfileUser.followers)?viewedProfileUser.followers:[];
  const following=Array.isArray(currentUserProfile?.following)?currentUserProfile.following:[];
  const isFollowing=followers.includes(currentUser.uid)||following.includes(viewedProfileUser.uid);
  viewFollowBtn.innerText=isFollowing?"Following":"Follow";
}

window.toggleFollowViewedProfile=async function(){
  if(!viewedProfileUser)return alert("Open a profile first.");
  await toggleFollowUser(viewedProfileUser.uid);
};

window.followUserFromFeed=async function(uid){
  await toggleFollowUser(uid);
};


window.messageViewedProfile=function(){
  if(viewedProfileUser) openPrivateChat(viewedProfileUser.uid);
};
window.callViewedProfile=function(){
  if(viewedProfileUser) requestCallToUser(viewedProfileUser.uid);
};

window.setAvatarEmoji=function(emoji){
  profileAvatarEmoji=emoji;
  profileAvatar.innerText=emoji;
};
window.setAvatarColor=function(color){
  profileAvatarColor=color;
  if(typeof avatarStyle === "function") profileAvatar.style.background=avatarStyle(color);
};

function listenPrivateMessages(chatId){
  if(unsubscribeMessages) unsubscribeMessages();
  if(!chatId || !document.getElementById("messagesBox"))return;
  const q=query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc"));
  unsubscribeMessages=onSnapshot(q,function(snapshot){
    const messages=[];
    window._lastMessages={};
    snapshot.forEach(d=>{
      const data={id:d.id,...d.data()};
      window._lastMessages[d.id]=data;
      messages.push(data);
    });
    if(!messages.length){
      messagesBox.innerHTML='<div class="chat-empty-note">No messages yet. Send first message to start chat.</div>';
      return;
    }
    messagesBox.innerHTML=messages.map(m=>{
      const sender=m.senderUid||m.uid;
      const mine=sender===currentUser.uid;
      const name=m.senderName||m.name||m.senderEmail||m.email||"User";
      return `<div class="${mine?'msg mine':'msg'}">
        <b>${safe(mine?'You':name)}</b>
        ${m.replyText?`<div class="replybar active">Reply: ${safe(m.replyText)}</div>`:''}
        ${renderKalbMessageBody(m)}
        <span class="muted">${formatDate(m.createdAt)} ${m.edited?' • edited':''}</span>
        <div class="actions">
          <button class="btn small" onclick='replyToMessage("${m.id}")'>Reply</button>
          <button class="btn small" onclick='copyMessage("${m.id}")'>Copy</button>
          ${mine?`<button class="btn small" onclick='editMessage("${m.id}")'>Edit</button>`:''}
        </div>
      </div>`;
    }).join("");
    messagesBox.scrollTop=messagesBox.scrollHeight;
  },console.error);
}
window.openPrivateChat=async function(uid){
  uid=String(uid||'').trim();
  if(!currentUser)return alert("Login first.");
  if(!uid)return alert("User not found.");
  let u=(allUsers||[]).find(x=>String(x.uid||x.id||'')===uid);
  if(!u){
    try{
      const us=await getDoc(doc(db,"users",uid));
      if(us.exists()){
        u={uid:us.id,id:us.id,...(us.data()||{})};
        allUsers=(allUsers||[]).filter(x=>String(x.uid||x.id||'')!==uid).concat([u]);
      }
    }catch(e){console.log('fallback user lookup failed',e);}
  }
  if(!u){
    u={uid:uid,id:uid,name:"User",displayName:"User",username:"user",handle:"user",email:""};
    allUsers=(allUsers||[]).filter(x=>String(x.uid||x.id||'')!==uid).concat([u]);
  }
  currentChatUser=u;
  currentChatId=chatIdForUser(uid);
  restoreDeletedChat(currentChatId);
  setArchivedChats(getArchivedChats().filter(x=>x!==currentChatId));
  if(document.getElementById("roomTitle"))roomTitle.innerText=u.name||u.displayName||u.email||"Chat";
  if(document.getElementById("roomSub"))roomSub.innerText="@"+(u.username||u.handle||"user")+(u.email?" • "+maskEmail(u.email):"");
  if(document.getElementById("messagesBox"))messagesBox.innerHTML='<div class="chat-empty-note">No messages yet. Send first message to start chat.</div>';
  if(document.getElementById("messageInput"))messageInput.value="";
  currentReply=null;
  if(typeof updateReplyBar==="function")updateReplyBar();
  openPage("chatRoomPage");
  listenPrivateMessages(currentChatId);
};

window.sendTypingStatus = async function(){
  if(!currentUser || !currentChatId) return;
  try{
    await setDoc(doc(db,"chats",currentChatId,"typing",currentUser.uid),{
      uid: currentUser.uid,
      typing: true,
      updatedAt: serverTimestamp()
    },{merge:true});
    clearTimeout(typingTimer);
    typingTimer = setTimeout(async function(){
      try{
        await setDoc(doc(db,"chats",currentChatId,"typing",currentUser.uid),{
          uid: currentUser.uid,
          typing: false,
          updatedAt: serverTimestamp()
        },{merge:true});
      }catch(e){}
    },1600);
  }catch(e){console.error(e)}
};

window.sendPrivateChat=async function(){
  if(await isCurrentUserBanned()) return alert('Your account is banned.');
  if(!currentUser || !currentChatId || !currentChatUser)return alert("Open a chat first.");
  const input=document.getElementById("messageInput");
  if(!input)return alert("Message input not found.");
  const text=input.value.trim();
  if(!text)return;
  const meSnap=await getDoc(doc(db,"users",currentUser.uid));
  const me=meSnap.exists()?meSnap.data():(currentUserProfile||{});
  restoreDeletedChat(currentChatId);
  setArchivedChats(getArchivedChats().filter(x=>x!==currentChatId));
  await setDoc(doc(db,"chats",currentChatId),{
    members:[currentUser.uid,currentChatUser.uid],
    memberNames:{
      [currentUser.uid]:me.name||currentUser.displayName||currentUser.email||"User",
      [currentChatUser.uid]:currentChatUser.name||currentChatUser.email||"User"
    },
    lastMessage:text,
    lastMessageAt:serverTimestamp(),
    lastSenderUid:currentUser.uid,
    updatedAt:serverTimestamp()
  },{merge:true});
  await addDoc(collection(db,"chats",currentChatId,"messages"),{
    text,
    replyText:currentReply?currentReply.text:"",
    replyTo:currentReply?currentReply.id:"",
    senderUid:currentUser.uid,
    senderEmail:currentUser.email||"",
    senderName:me.name||currentUser.displayName||"User",
    createdAt:serverTimestamp(),
    seen:false
  });
  input.value="";
  currentReply=null;
  if(typeof updateReplyBar==="function")updateReplyBar();
  try{
    await setDoc(doc(db,"chats",currentChatId,"typing",currentUser.uid),{uid:currentUser.uid,typing:false,updatedAt:serverTimestamp()},{merge:true});
  }catch(e){}
  renderChatListCache();
};

window.pinCurrentChat=function(){
  if(!currentChatId)return;
  const meta=getChatMeta(currentChatId);
  setChatMeta(currentChatId,{pinned:!meta.pinned});
  alert(!meta.pinned?"Chat pinned.":"Chat unpinned.");
  renderChatListCache();
};
window.archiveCurrentChat=function(){
  if(!currentChatId)return alert("Open a chat first.");
  archiveChat(currentChatId);
  openPage("chatsPage");
};
window.clearCurrentChat=async function(){
  if(!currentChatId||!confirm("Clear this chat for everyone?"))return;
  const snap=await getDocs(collection(db,"chats",currentChatId,"messages"));
  const batch=writeBatch(db);
  snap.forEach(d=>batch.delete(doc(db,"chats",currentChatId,"messages",d.id)));
  await batch.commit();
  await updateDoc(doc(db,"chats",currentChatId),{lastMessage:"Chat cleared",updatedAt:serverTimestamp()});
};
window.editMessage=async function(id){
  const m=window._lastMessages&&window._lastMessages[id];
  if(!m||m.senderUid!==currentUser.uid)return alert("You can edit only your message.");
  const text=prompt("Edit message:",m.text||"");
  if(text!==null&&text.trim())await updateDoc(doc(db,"chats",currentChatId,"messages",id),{text:text.trim(),edited:true,editedAt:serverTimestamp()});
};

window.replyToMessage=function(id){
  const m=window._lastMessages&&window._lastMessages[id];
  if(!m)return;
  currentReply={id,text:m.text||""};
  updateReplyBar();
  messageInput.focus();
}
window.cancelReply=function(){currentReply=null;updateReplyBar()}
function updateReplyBar(){
  if(currentReply){replyBar.classList.add("active");replyText.innerText="Replying to: "+currentReply.text}
  else{replyBar.classList.remove("active");replyText.innerText=""}
}
window.copyMessage=function(id){
  const m=window._lastMessages&&window._lastMessages[id];
  if(m)navigator.clipboard.writeText(m.text||"").then(()=>alert("Message copied"));
}
window.deleteMessage=async function(id){
  if(!currentChatId)return;
  if(confirm("Delete this message?"))await deleteDoc(doc(db,"chats",currentChatId,"messages",id));
}

let showArchivedOnly=false;
let cachedChats=[];
function listenChats(){
  if(!currentUser)return;
  if(unsubscribeChats) unsubscribeChats();
  const q=query(collection(db,"chats"),where("members","array-contains",currentUser.uid));
  unsubscribeChats=onSnapshot(q,function(snapshot){
    cachedChats=[];
    snapshot.forEach(d=>cachedChats.push({id:d.id,...d.data()}));
    renderChatListCache();
  },console.error);
}
function updateUnreadBadge(){
  if(unreadTotal>0){unreadBadge.classList.remove("hidden");unreadBadge.innerText=unreadTotal}
  else unreadBadge.classList.add("hidden");
}
async function loadProfile(){
  if(!currentUser)return;
  const ref=doc(db,"users",currentUser.uid);
  let snap=await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref,{
      uid:currentUser.uid,
      name:currentUser.displayName||"User",
      username:"user_"+currentUser.uid.slice(0,5),
      bio:"Hey there, I am using Kalb Message.",
      email:currentUser.email||"",
      avatarEmoji:"😀",
      avatarColor:"purpleBlue",
      followers:[],
      following:[],
      hideOnline:false,
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});
    snap=await getDoc(ref);
  }
  const u=snap.exists()?snap.data():{};
  currentUserProfile=u;
  if(document.getElementById("profileAvatar")){
    profileAvatar.innerText=u.avatarEmoji||initials(u.name,currentUser.email);
    if(typeof avatarStyle==="function")profileAvatar.style.background=avatarStyle(u.avatarColor);
  }
  if(document.getElementById("profileDisplayName"))profileDisplayName.innerText=u.name||"User";
  if(document.getElementById("profileEmail"))profileEmail.innerText=currentUser.email||"";
  if(document.getElementById("profileJoined"))profileJoined.innerText=u.createdAt?("Joined: "+formatDate(u.createdAt)):"";
  if(document.getElementById("profileName"))profileName.value=u.name||"";
  if(document.getElementById("profileUsername"))profileUsername.value=u.username||"";
  if(document.getElementById("profileBio"))profileBio.value=u.bio||"";
  profileAvatarEmoji=u.avatarEmoji||"😀";
  profileAvatarColor=u.avatarColor||"purpleBlue";
  const ownFollowers=Array.isArray(u.followers)?u.followers.length:0;
  const ownFollowing=Array.isArray(u.following)?u.following.length:0;
  if(document.getElementById("homeUser"))homeUser.innerText=(u.name||"User")+" • @"+(u.username||"user")+" • "+ownFollowers+" followers • following "+ownFollowing;
  if(document.getElementById("privacyBtn"))privacyBtn.innerText=u.hideOnline?"Show Online Status":"Hide Online Status";
  if(document.getElementById("profilePostsCount"))profilePostsCount.innerText=(allPosts||[]).filter(p=>p.uid===currentUser.uid).length;
  if(document.getElementById("profileChatsCount"))profileChatsCount.innerText=(cachedChats||[]).length;
  if(document.getElementById("profileGroupsCount"))profileGroupsCount.innerText=(allGroups||[]).length;
  if(document.getElementById("profileCoinsCount"))profileCoinsCount.innerText=(typeof kalbCoinsNum==="function"?kalbCoinsNum(u.kalbCoins):(Number(u.kalbCoins||0)||0));
  if(typeof kalbRenderCoinsSystem==="function")kalbRenderCoinsSystem();
  if(document.getElementById("profilePrivacyStatus"))profilePrivacyStatus.innerText=(u.privateProfile?"Your profile is Private":"Your profile is Public");
  if(typeof loadProfileUpgradeInputs==="function")loadProfileUpgradeInputs();
}
window.setAvatarEmoji=function(emoji){
  profileAvatarEmoji=emoji;
  if(document.getElementById("profileAvatar")) profileAvatar.innerText=emoji;
};
window.setAvatarColor=function(color){
  profileAvatarColor=color;
  if(document.getElementById("profileAvatar")) profileAvatar.style.background=avatarStyle(color);
};

window.saveProfile=async function(){
  if(!currentUser)return alert("Login first.");
  const name=(profileName.value||"").trim()||"User";
  const username=(profileUsername.value||"").trim().replace(/\s+/g,"_").toLowerCase()||("user_"+currentUser.uid.slice(0,5));
  const bio=(profileBio.value||"").trim()||"Hey there, I am using Kalb Message.";
  const old=currentUserProfile||{};
  const data={
    uid:currentUser.uid,
    name,
    username,
    bio,
    email:currentUser.email||"",
    avatarEmoji:profileAvatarEmoji||old.avatarEmoji||"😀",
    avatarColor:profileAvatarColor||old.avatarColor||"purpleBlue",
    followers:Array.isArray(old.followers)?old.followers:[],
    following:Array.isArray(old.following)?old.following:[],
    hideOnline:old.hideOnline===true,
    updatedAt:serverTimestamp()
  };
  if(!old.createdAt)data.createdAt=serverTimestamp();
  await setDoc(doc(db,"users",currentUser.uid),data,{merge:true});
  currentUserProfile={...old,...data};
  await loadProfile();
  if(typeof renderUsers==="function")renderUsers();
  alert("Profile saved successfully.");
};





function chatIdForUser(uid){
  return [currentUser.uid,uid].sort().join("_");
}
function getArchivedChats(){
  try{return JSON.parse(localStorage.getItem("kalbArchivedChats_"+currentUser.uid)||"[]")}catch(e){return[]}
}
function setArchivedChats(list){
  localStorage.setItem("kalbArchivedChats_"+currentUser.uid,JSON.stringify(Array.from(new Set(list))));
}
function isChatArchived(chatId){
  return getArchivedChats().includes(chatId);
}
function getDeletedChatMap(){
  try{return JSON.parse(localStorage.getItem("kalbDeletedChatMap_"+currentUser.uid)||"{}")}catch(e){return{}}
}
function setDeletedChatMap(map){
  localStorage.setItem("kalbDeletedChatMap_"+currentUser.uid,JSON.stringify(map||{}));
}
function markChatDeleted(chatId){
  const map=getDeletedChatMap();
  map[chatId]=Date.now();
  setDeletedChatMap(map);
}
function restoreDeletedChat(chatId){
  const map=getDeletedChatMap();
  delete map[chatId];
  setDeletedChatMap(map);
}
function isChatHiddenDeleted(chat){
  const map=getDeletedChatMap();
  const deletedAt=map[chat.id];
  if(!deletedAt)return false;
  const updated=((chat.lastMessageAt&&chat.lastMessageAt.seconds)||(chat.updatedAt&&chat.updatedAt.seconds)||0)*1000;
  return !updated || updated<=deletedAt;
}
window.archiveChat=function(chatId){
  const list=getArchivedChats();
  if(!list.includes(chatId))list.push(chatId);
  setArchivedChats(list);
  renderChatListCache();
};
window.unarchiveChat=function(chatId){
  setArchivedChats(getArchivedChats().filter(x=>x!==chatId));
  renderChatListCache();
};
window.deleteChatLocal=function(chatId){
  if(!confirm("Delete this chat from your chat list? It will appear again when a new message is sent or received."))return;
  markChatDeleted(chatId);
  setArchivedChats(getArchivedChats().filter(x=>x!==chatId));
  if(currentChatId===chatId){
    currentChatId="";
    currentChatUser=null;
    openPage("chatsPage");
  }
  renderChatListCache();
};
window.deleteCurrentChat=function(){
  if(!currentChatId)return alert("Open a chat first.");
  deleteChatLocal(currentChatId);
};
window.showArchivedChats=function(){
  showArchivedOnly=true;
  renderChatListCache();
};
window.showActiveChats=function(){
  showArchivedOnly=false;
  renderChatListCache();
};

function renderChatListCache(){
  const box=document.getElementById("chatList")||document.getElementById("chatsList");
  if(!box)return;
  const search=(document.getElementById("chatSearchInput")?chatSearchInput.value:"").toLowerCase();
  let chats=(cachedChats||[]).filter(c=>{
    const hasRealMessage=!!(c.lastMessage || c.lastMessageAt || c.updatedAt);
    if(!hasRealMessage)return false;
    if(isChatHiddenDeleted(c))return false;
    const archived=isChatArchived(c.id);
    if(showArchivedOnly || chatFilter==="archived") return archived;
    if(chatFilter==="pinned") return (c.pinnedBy||[]).includes(currentUser.uid);
    return !archived;
  });
  chats=chats.filter(c=>{
    const otherId=(c.members||[]).find(x=>x!==currentUser.uid);
    const u=(allUsers||[]).find(x=>x.uid===otherId)||{};
    const name=((c.memberNames&&c.memberNames[otherId])||u.name||u.email||"User").toLowerCase();
    return !search || name.includes(search) || String(c.lastMessage||"").toLowerCase().includes(search);
  });
  chats.sort((a,b)=>{
    const at=(a.lastMessageAt&&a.lastMessageAt.seconds)||(a.updatedAt&&a.updatedAt.seconds)||0;
    const bt=(b.lastMessageAt&&b.lastMessageAt.seconds)||(b.updatedAt&&b.updatedAt.seconds)||0;
    return bt-at;
  });
  if(!chats.length){
    box.innerHTML=`<div class="card empty">${(showArchivedOnly||chatFilter==="archived")?"No archived chats.":"No active chats yet."}</div>`;
    return;
  }
  box.innerHTML=chats.map(c=>{
    const otherId=(c.members||[]).find(x=>x!==currentUser.uid);
    const u=(allUsers||[]).find(x=>x.uid===otherId)||{};
    const name=(c.memberNames&&c.memberNames[otherId])||u.name||u.email||"User";
    const archived=isChatArchived(c.id);
    const pinned=(c.pinnedBy||[]).includes(currentUser.uid);
    return `<div class="card user-row">
      <div class="avatar">${safe(u.avatarEmoji||initials(name,u.email))}</div>
      <div class="user-info">
        <h3>${safe(name)} ${archived?'<span class="archived-label">Archived</span>':''} ${pinned?'<span class="archived-label">Pinned</span>':''}</h3>
        <p class="muted">${safe(c.lastMessage||"")}</p>
      </div>
      <div class="actions">
        <button class="btn small" onclick='openPrivateChat("${otherId}")'>Open</button>
        ${archived?`<button class="btn small" onclick='unarchiveChat("${c.id}")'>Unarchive</button>`:`<button class="btn small" onclick='archiveChat("${c.id}")'>Archive</button>`}
        <button class="btn small red" onclick='deleteChatLocal("${c.id}")'>Delete</button>
      </div>
    </div>`;
  }).join("");
}

function listenGroups(){
  if(unsubscribeGroups) unsubscribeGroups();
  const q = query(collection(db,"groups"), where("members","array-contains",currentUser.uid));
  unsubscribeGroups = onSnapshot(q,function(snapshot){
    allGroups = [];
    snapshot.forEach(d=>allGroups.push({id:d.id,...d.data()}));
    allGroups.sort((a,b)=>{
      const aa=a.updatedAt&&a.updatedAt.seconds?a.updatedAt.seconds:0;
      const bb=b.updatedAt&&b.updatedAt.seconds?b.updatedAt.seconds:0;
      return bb-aa;
    });
    renderGroups();
  },function(error){
    console.error(error);
    groupsList.innerHTML='<div class="card"><p class="muted">Groups could not load. Check Firestore rules.</p></div>';
  });
}

window.renderGroups = function(){
  if(!groupsList) return;
  if(!allGroups.length){
    groupsList.innerHTML='<div class="card empty">No groups yet. Create your first group.</div>';
    return;
  }
  groupsList.innerHTML = allGroups.map(g=>`<div class="card" onclick='openGroupRoom("${g.id}")'>
    <div class="user-row">
      <div class="avatar">👥</div>
      <div class="user-info">
        <h3>${safe(g.name||"Group")}</h3>
        <p>${(g.members||[]).length} members • ${safe(g.lastMessage||"Open group chat")}</p>
      </div>
    </div>
  </div>`).join("");
};

window.renderGroupMemberPicker = function(){
  if(!groupMembersPick) return;
  const list = allUsers.filter(u=>u.uid!==currentUser.uid);
  if(!list.length){
    groupMembersPick.innerHTML='<p class="muted">No other users found.</p>';
    return;
  }
  groupMembersPick.innerHTML = list.map(u=>`<label class="group-member">
    <input type="checkbox" value="${u.uid}">
    <span>${safe(u.name||"User")} (@${safe(u.username||"user")})</span>
  </label>`).join("");
};

window.createGroup = async function(){
  if(await isCurrentUserBanned()) return alert('Your account is banned.');
  const name = groupNameInput.value.trim();
  const desc = groupDescInput.value.trim();
  if(!name) return showStatus("groupCreateStatus","Enter group name.",true);
  const picked = [...groupMembersPick.querySelectorAll("input:checked")].map(x=>x.value);
  const members = Array.from(new Set([currentUser.uid,...picked]));
  const meSnap = await getDoc(doc(db,"users",currentUser.uid));
  const me = meSnap.exists()?meSnap.data():{};
  const groupRef = await addDoc(collection(db,"groups"),{
    name,
    desc,
    adminUid: currentUser.uid,
    adminName: me.name || currentUser.displayName || "User",
    members,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage:""
  });
  groupNameInput.value="";
  groupDescInput.value="";
  showStatus("groupCreateStatus","Group created.");
  openGroupRoom(groupRef.id);
};

window.openGroupRoom = async function(groupId){
  currentGroupId = groupId;
  currentGroup = allGroups.find(g=>g.id===groupId);
  if(!currentGroup){
    const snap = await getDoc(doc(db,"groups",groupId));
    currentGroup = snap.exists()?{id:snap.id,...snap.data()}:null;
  }
  if(!currentGroup) return alert("Group not found.");
  groupRoomTitle.innerText = currentGroup.name || "Group";
  groupRoomSub.innerText = (currentGroup.members||[]).length + " members • Admin: " + (currentGroup.adminName||"User");
  groupInfoBox.classList.add("hidden");
  openPage("groupRoomPage");

  if(unsubscribeGroupMessages) unsubscribeGroupMessages();
  const q = query(collection(db,"groups",currentGroupId,"messages"), orderBy("createdAt","asc"));
  unsubscribeGroupMessages = onSnapshot(q,function(snapshot){
    groupMessagesBox.innerHTML="";
    snapshot.forEach(d=>{
      const m = d.data();
      const mine = m.senderUid===currentUser.uid;
      groupMessagesBox.innerHTML += `<div class="msg ${mine?'me':''}">
        <div class="msg-name">${mine?'You':safe(m.senderName||'User')}</div>
        <div>${safe(m.text||'')}</div>
        <div class="msg-time">${formatTime(m.createdAt)}</div>
        <div class="msg-tools">
          <button class="toolbtn" onclick='copyGroupMessage("${d.id}")'>Copy</button>
          ${mine||currentGroup.adminUid===currentUser.uid?`<button class="toolbtn" onclick='deleteGroupMessage("${d.id}")'>Delete</button>`:""}
        </div>
      </div>`;
    });
    groupMessagesBox.scrollTop=groupMessagesBox.scrollHeight;
    window._lastGroupMessages={};
    snapshot.forEach(d=>window._lastGroupMessages[d.id]=d.data());
  });
};

window.sendGroupMessage = async function(){
  if(await isCurrentUserBanned()) return alert('Your account is banned.');
  const text = groupMessageInput.value.trim();
  if(!text || !currentGroupId) return;
  const meSnap = await getDoc(doc(db,"users",currentUser.uid));
  const me = meSnap.exists()?meSnap.data():{};
  await addDoc(collection(db,"groups",currentGroupId,"messages"),{
    text,
    senderUid: currentUser.uid,
    senderEmail: currentUser.email||"",
    senderName: me.name || currentUser.displayName || "User",
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db,"groups",currentGroupId),{lastMessage:text,updatedAt:serverTimestamp()});
  groupMessageInput.value="";
};

window.showGroupInfo = function(){
  if(!currentGroup) return;
  const admin=currentGroup.adminUid===currentUser.uid;
  const memberRows=(currentGroup.members||[]).map(uid=>{
    const u=allUsers.find(x=>x.uid===uid)||{};
    return `<div class="group-member">👤 ${safe(u.name||u.email||uid)} ${uid===currentGroup.adminUid?"• admin":""}
      ${admin&&uid!==currentUser.uid?`<button class="toolbtn" onclick='removeGroupMember("${uid}")'>Remove</button><button class="toolbtn" onclick='promoteGroupAdmin("${uid}")'>Make Admin</button>`:""}
    </div>`;
  }).join("");
  const notMembers=allUsers.filter(u=>!(currentGroup.members||[]).includes(u.uid));
  groupInfoBox.classList.toggle("hidden");
  groupInfoBox.innerHTML=`<h3>Group Info</h3><p class="muted">${safe(currentGroup.desc||"No description")}</p>
    ${admin?`<input id="editGroupName" value="${safe(currentGroup.name||"Group")}" placeholder="Group name"><textarea id="editGroupDesc" placeholder="Group description">${safe(currentGroup.desc||"")}</textarea><button class="btn full" onclick="saveGroupInfo()">Save Group Info</button>`:""}
    <h4 style="margin-top:12px">Members</h4>${memberRows}
    <h4 style="margin-top:14px">Add New Members</h4>
    ${notMembers.length?notMembers.map(u=>`<label class="group-member"><input type="checkbox" class="addMemberCheck" value="${u.uid}"><span>${safe(u.name||"User")} (@${safe(u.username||"user")})</span></label>`).join(""):`<p class="muted">All users are already in this group.</p>`}
    ${notMembers.length?`<button class="btn full green" onclick="addSelectedMembersToGroup()">Add Selected Members</button>`:""}
    ${admin?`<button class="btn red full" onclick="deleteGroup()">Delete Group</button>`:""}`;
};

window.addSelectedMembersToGroup = async function(){
  if(!currentGroup || !currentGroupId) return;
  const picked = [...document.querySelectorAll(".addMemberCheck:checked")].map(x=>x.value);
  if(!picked.length) return alert("Select at least one user.");
  const members = Array.from(new Set([...(currentGroup.members||[]), ...picked]));
  await updateDoc(doc(db,"groups",currentGroupId),{members,updatedAt:serverTimestamp()});
  currentGroup.members = members;
  alert("Members added.");
  showGroupInfo();
};


window.saveGroupInfo=async function(){
  if(!currentGroup||currentGroup.adminUid!==currentUser.uid)return alert("Only group admin can edit.");
  const name=editGroupName.value.trim()||"Group";
  const desc=editGroupDesc.value.trim();
  await updateDoc(doc(db,"groups",currentGroupId),{name,desc,updatedAt:serverTimestamp()});
  currentGroup.name=name;currentGroup.desc=desc;groupRoomTitle.innerText=name;
  alert("Group info updated.");
};
window.removeGroupMember=async function(uid){
  if(!currentGroup||currentGroup.adminUid!==currentUser.uid)return alert("Only group admin can remove.");
  const members=(currentGroup.members||[]).filter(x=>x!==uid);
  await updateDoc(doc(db,"groups",currentGroupId),{members,updatedAt:serverTimestamp()});
  currentGroup.members=members;showGroupInfo();
};
window.promoteGroupAdmin=async function(uid){
  if(!currentGroup||currentGroup.adminUid!==currentUser.uid)return alert("Only group admin can promote.");
  const u=allUsers.find(x=>x.uid===uid)||{};
  await updateDoc(doc(db,"groups",currentGroupId),{adminUid:uid,adminName:u.name||u.email||"User",updatedAt:serverTimestamp()});
  currentGroup.adminUid=uid;currentGroup.adminName=u.name||u.email||"User";showGroupInfo();
};

window.leaveGroup = async function(){
  if(!currentGroup || !confirm("Leave this group?")) return;
  const members = (currentGroup.members||[]).filter(uid=>uid!==currentUser.uid);
  await updateDoc(doc(db,"groups",currentGroupId),{members,updatedAt:serverTimestamp()});
  openPage("groupsPage");
};

window.deleteGroup = async function(){
  if(!currentGroup || currentGroup.adminUid!==currentUser.uid) return;
  if(confirm("Delete this group?")) {
    await deleteDoc(doc(db,"groups",currentGroupId));
    openPage("groupsPage");
  }
};

window.copyGroupMessage = function(id){
  const m = window._lastGroupMessages && window._lastGroupMessages[id];
  if(m) navigator.clipboard.writeText(m.text||"").then(()=>alert("Message copied"));
};

window.deleteGroupMessage = async function(id){
  if(confirm("Delete this group message?")) await deleteDoc(doc(db,"groups",currentGroupId,"messages",id));
};


function listenPosts(){
  if(unsubscribePosts) unsubscribePosts();
  const q = query(collection(db,"posts"), orderBy("createdAt","desc"));
  unsubscribePosts = onSnapshot(q,function(snapshot){
    allPosts = [];
    snapshot.forEach(d => allPosts.push({id:d.id,...d.data()}));
    renderPosts();
  },function(error){
    console.error("Posts load error:", error);
    const msg = '<div class="card"><p class="muted">Posts could not load. Check Firestore rules.</p></div>';
    const pb=document.getElementById("postsBox");
    const hb=document.getElementById("homeFeedBox");
    if(pb)pb.innerHTML=msg;
    if(hb)hb.innerHTML=msg;
  });
}

function getPostPrivacy(){
  return document.getElementById("newPostPrivacy")?.value || document.getElementById("postPrivacy")?.value || "public";
}

function canViewPost(p){
  if(!p) return false;
  if(p.type==="story" || p.type==="status") return false;
  const privacy=p.privacy||"public";
  if(privacy==="public") return true;
  if(!currentUser) return false;
  if(p.uid===currentUser.uid) return true;
  if(privacy==="private") return false;
  if(privacy==="friends"){
    const owner=(allUsers||[]).find(u=>u.uid===p.uid)||{};
    const ownerFriends=Array.isArray(owner.friends)?owner.friends:[];
    const myFriends=Array.isArray(currentUserProfile?.friends)?currentUserProfile.friends:[];
    return ownerFriends.includes(currentUser.uid) || myFriends.includes(p.uid);
  }
  return true;
}

window.createPost = async function(source){
  try{
    if(await isCurrentUserBanned()) return alert('Your account is banned.');
    if(!currentUser) return alert("Please login first.");

    const homeText=document.getElementById("homePostText");
    const feedText=document.getElementById("postText");
    let textBox = source==="home" ? homeText : source==="feed" ? feedText : null;
    if(!textBox){
      if(homeText && homeText.value.trim()) textBox=homeText;
      else if(feedText && feedText.value.trim()) textBox=feedText;
      else textBox=feedText || homeText;
    }

    const text=(textBox?.value||"").trim();
    if(!text) {
      if(source==="home") alert("Write something first.");
      else showStatus("postStatus","Write something first.",true);
      return;
    }

    showStatus("postStatus","Posting...");
    const meSnap=await getDoc(doc(db,"users",currentUser.uid));
    const me=meSnap.exists()?meSnap.data():{};
    await addDoc(collection(db,"posts"),{
      text:text,
      content:text,
      uid:currentUser.uid,
      userId:currentUser.uid,
      authorUid:currentUser.uid,
      email:currentUser.email||"",
      name:me.name||currentUser.displayName||((currentUser.email||"User").split("@")[0]),
      username:me.username||((currentUser.email||"user").split("@")[0]),
      avatarEmoji:me.avatarEmoji||"👤",
      avatarColor:me.avatarColor||"",
      likes:[],
      savedBy:[],
      commentsCount:0,
      type:"post",
      privacy:getPostPrivacy(),
      pinned:false,
      repostOf:"",
      reactions:{},
      userReactions:{},
      edited:false,
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    if(textBox) textBox.value="";
    try{ await createActivity("post","created a new post",""); }catch(e){}
    showStatus("postStatus","Posted ✅");
    renderPosts();
  }catch(err){
    console.error("createPost failed",err);
    showStatus("postStatus","Post failed: "+(err.message||err),true);
    alert("Post failed: "+(err.message||err));
  }
};

window.createPostFromHome=function(){
  return window.createPost("home");
};

window.reactToPostFinal=async function(postId, emoji){
  if(!currentUser)return alert("Please login first.");
  const p=(allPosts||[]).find(x=>x.id===postId)||{};
  const userReactions={...(p.userReactions||{})};
  const reactions={...(p.reactions||{})};
  const old=userReactions[currentUser.uid] || reactions[currentUser.uid] || "";
  if(old===emoji){
    delete userReactions[currentUser.uid];
    delete reactions[currentUser.uid];
  }else{
    userReactions[currentUser.uid]=emoji;
    reactions[currentUser.uid]=emoji;
  }
  await updateDoc(doc(db,"posts",postId),{userReactions,reactions,updatedAt:serverTimestamp()});
};
window.likePost=window.reactToPostFinal;

function reactionCount(p, emoji){
  const ur=p.userReactions||{};
  const r=p.reactions||{};
  let n=0;
  Object.values(ur).forEach(v=>{if(v===emoji)n++;});
  Object.entries(r).forEach(([k,v])=>{
    if(k===emoji && typeof v==="number") n=Math.max(n,v);
    else if(v===emoji && !ur[k]) n++;
  });
  return n;
}

function myReaction(p){
  if(!currentUser)return "";
  return (p.userReactions||{})[currentUser.uid] || (p.reactions||{})[currentUser.uid] || "";
}


let storyViewerList=[];
let storyViewerIndex=0;
function storyViewerTimeLabel(s){
  try{return s.createdAt?.seconds ? new Date(s.createdAt.seconds*1000).toLocaleString() : 'Story';}catch(e){return 'Story';}
}
function storyViewerNames(s){
  const ids=Array.isArray(s.views)?s.views:[];
  return ids.map(uid=>{
    const u=(allUsers||[]).find(x=>x.uid===uid)||{};
    return safe(u.name||u.username||u.email||'Unknown user');
  });
}
async function markStoryViewed(story){
  if(!story?.id || !currentUser?.uid)return;
  const views=Array.isArray(story.views)?story.views:[];
  if(views.includes(currentUser.uid))return;
  try{await updateDoc(doc(db,'posts',story.id),{views:arrayUnion(currentUser.uid)});story.views=[...views,currentUser.uid];}catch(e){console.warn('Story view update failed',e);}
}
window.openStoryViewer=async function(postId){
  storyViewerList=(allPosts||[]).filter(p=>p.type==='story'||p.type==='status').sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  storyViewerIndex=Math.max(0,storyViewerList.findIndex(p=>p.id===postId));
  await renderStoryViewer();
  const m=document.getElementById('storyViewerModal'); if(m){m.classList.add('show');m.setAttribute('aria-hidden','false');}
};
window.closeStoryViewer=function(){const m=document.getElementById('storyViewerModal'); if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true');}};
window.nextStory=async function(){if(!storyViewerList.length)return;storyViewerIndex=(storyViewerIndex+1)%storyViewerList.length;await renderStoryViewer();};
window.prevStory=async function(){if(!storyViewerList.length)return;storyViewerIndex=(storyViewerIndex-1+storyViewerList.length)%storyViewerList.length;await renderStoryViewer();};
window.toggleStoryViewers=function(){document.getElementById('storyViewerViewers')?.classList.toggle('show');};
async function renderStoryViewer(){
  const s=storyViewerList[storyViewerIndex]; if(!s)return;
  await markStoryViewed(s);
  const owner=(allUsers||[]).find(u=>u.uid===s.uid)||{};
  const avatar=owner.avatarEmoji||s.avatarEmoji||initials(s.name,s.email);
  const set=(id,v)=>{const el=document.getElementById(id); if(el)el.innerHTML=v;};
  set('storyViewerAvatar',safe(avatar));
  set('storyViewerName',safe(owner.name||s.name||'User'));
  set('storyViewerTime',safe(storyViewerTimeLabel(s)));
  set('storyViewerText',safe(s.text||''));
  const views=Array.isArray(s.views)?s.views:[];
  set('storyViewerCount',`${views.length} view${views.length===1?'':'s'}`);
  const viewers=storyViewerNames(s);
  set('storyViewerViewers',viewers.length?viewers.map(n=>`<div>👁️ ${n}</div>`).join(''):'<div>No views yet.</div>');
}

window.renderPosts = function(){
  let posts=allPosts.filter(canViewPost);
  if(feedFilter==="trending"){
    posts.sort((a,b)=>((b.likes||[]).length+(b.commentsCount||0))-((a.likes||[]).length+(a.commentsCount||0)));
  }else if(feedFilter==="saved"){
    posts=posts.filter(p=>(p.savedBy||[]).includes(currentUser?.uid));
  }else if(feedFilter==="mine"){
    posts=posts.filter(p=>p.uid===currentUser?.uid);
  }else{
    posts.sort((a,b)=>{
      if(a.pinned&&!b.pinned)return -1;
      if(!a.pinned&&b.pinned)return 1;
      return (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
    });
  }
  renderPostsInto("postsBox",posts);
  renderPostsInto("homeFeedBox",posts.slice(0,8));
  const storyBox=document.getElementById("storyStrip");
  if(storyBox){
    const stories=allPosts.filter(p=>p.type==="story"||p.type==="status").slice(0,12);
    storyBox.innerHTML=stories.map(s=>`<div class="story-item" onclick="openStoryViewer('${s.id}')"><b>${safe(s.name||"User")}</b><p>${safe(s.text||"")}</p><small>${Array.isArray(s.views)?s.views.length:0} views</small></div>`).join("")||'<div class="story-item muted">No stories yet.</div>';
  }
  try{renderAdminExtra();}catch(e){}
};

function renderPostsInto(boxId, posts){
  const box=document.getElementById(boxId);
  if(!box)return;
  const key=String(boxId||"default").replace(/[^a-zA-Z0-9_-]/g,"_");
  if(!posts || !posts.length){
    box.innerHTML='<div class="card empty">No posts yet. Be the first to post.</div>';
    return;
  }
  box.innerHTML=posts.map(p=>{
    const saved=(p.savedBy||[]).includes(currentUser?.uid);
    const canDelete=currentUser && p.uid===currentUser.uid;
    const commentsCount=p.commentsCount||0;
    const owner=(allUsers||[]).find(u=>u.uid===p.uid)||{};
    const avatar=owner.avatarEmoji||p.avatarEmoji||initials(p.name,p.email);
    const bg=typeof avatarStyle==="function"?avatarStyle(owner.avatarColor||p.avatarColor):"";
    const isFollowing=(currentUserProfile?.following||[]).includes(p.uid);
    const canFollow=currentUser && p.uid && p.uid!==currentUser.uid;
    const emojis=["❤️","😂","😮","😢","👍"];
    const mine=myReaction(p);
    const reactionButtons=emojis.map(e=>`<button class="react-btn ${mine===e?"active":""}" onclick='reactToPostFinal("${p.id}","${e}")'>${e} ${reactionCount(p,e)}</button>`).join("");
    const privacy=p.privacy||"public";
    return `<div class="post-box" data-post-id="${p.id}">
      ${p.pinned?'<span class="post-pin">Pinned</span>':''}
      <span class="post-pin">${privacy==="public"?"🌍 Public":privacy==="friends"?"👥 Friends":"🔒 Private"}</span>
      <div class="post-head">
        <div class="avatar" onclick='viewUserProfile("${p.uid||""}")' style="cursor:pointer;background:${bg}">${safe(avatar)}</div>
        <div class="user-info">
          <h3>${safe(p.name||owner.name||"User")} ${typeof verifiedHtml==="function"?verifiedHtml(owner):""}</h3>
          <p>@${safe(p.username||owner.username||"user")} • ${formatDate(p.createdAt)}</p>
          <button class="feed-profile-btn" onclick='viewUserProfile("${p.uid||""}")'>View Profile</button>
        </div>
      </div>
      <div class="post-text" id="postText_${key}_${p.id}">${safe(p.text||p.content||"")}</div>
      <div class="post-actions">
        <div class="reaction-row" style="width:100%;display:flex;gap:7px;flex-wrap:wrap">${reactionButtons}</div>
        ${canFollow?`<button class="btn small" onclick='followUserFromFeed("${p.uid}")'>${isFollowing?"Following":"Follow"}</button>`:""}
        <button class="btn small" onclick='toggleComments("${p.id}","${key}")'>Comments (<span data-comment-count="${p.id}">${commentsCount}</span>)</button>
        <button class="btn small ${saved?'green':''}" onclick='toggleSavePost("${p.id}")'>${saved?'Saved':'Save'}</button>
        <button class="btn small" onclick='repostPost("${p.id}")'>Repost</button>
        ${canDelete?`<button class="btn small" onclick='pinPost("${p.id}")'>${p.pinned?"Unpin":"Pin"}</button><button class="btn small" onclick='editPost("${p.id}")'>Edit</button><button class="btn small red" onclick='deletePost("${p.id}")'>Delete</button>`:`<button class="btn small red" onclick='reportPost("${p.id}")'>Report</button>`}
      </div>
      <div id="comments_${key}_${p.id}" data-comments-post="${p.id}" data-comment-key="${key}" class="comments hidden">
        <div id="commentList_${key}_${p.id}" data-comment-list="true"></div>
        <div class="comment-box">
          <input id="commentInput_${key}_${p.id}" data-comment-input="true" placeholder="Write a comment...">
          <button class="btn small" onclick='addComment("${p.id}","${key}")'>Send</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

window.toggleComments=function(postId, boxKey){
  const box=findCommentBox(postId, boxKey);
  if(!box){
    alert("Comment box not found. Refresh once.");
    return;
  }
  const opening=box.classList.contains("hidden") || box.style.display==="none";
  box.classList.toggle("hidden", !opening);
  box.style.display=opening ? "block" : "";
  if(opening) listenPostComments(postId, boxKey);
};



function listenPostComments(postId, boxKey){
  const list=findCommentList(postId, boxKey);
  if(!list)return;
  list.innerHTML='<p class="muted">Loading comments...</p>';
  const key=(boxKey||"default")+"_"+postId;
  window._commentUnsubs=window._commentUnsubs||{};
  if(window._commentUnsubs[key]){try{window._commentUnsubs[key]();}catch(e){}}
  const q=query(collection(db,"posts",postId,"comments"),orderBy("createdAt","asc"));
  window._commentUnsubs[key]=onSnapshot(q,function(snapshot){
    const comments=[];
    snapshot.forEach(d=>comments.push({id:d.id,...d.data()}));
    if(!comments.length){
      list.innerHTML='<p class="muted">No comments yet.</p>';
      return;
    }
    list.innerHTML=comments.map(c=>`<div class="comment-item">
      <b>${safe(c.name||c.username||c.email||"User")}</b>
      <p>${safe(c.text||"")}</p>
      <p class="muted">${formatDate(c.createdAt)}</p>
    </div>`).join("");
    document.querySelectorAll('[data-comment-count="'+postId+'"]').forEach(el=>el.innerText=comments.length);
  },function(error){
    console.error("Comment load error:", error);
    list.innerHTML='<div class="comment-error">Comments could not load. Check Firestore comments rules.</div>';
  });
}





window.addComment=async function(postId, boxKey){
  if(!currentUser)return alert("Login first.");
  const input=findCommentInput(postId, boxKey);
  if(!input)return alert("Comment input not found.");
  const text=(input.value||"").trim();
  if(!text)return;
  const me=currentUserProfile||{};
  try{
    await addDoc(collection(db,"posts",postId,"comments"),{
      text,
      uid:currentUser.uid,
      email:currentUser.email||"",
      name:me.name||currentUser.displayName||"User",
      username:me.username||"user",
      createdAt:serverTimestamp()
    });
    input.value="";
    const p=(allPosts||[]).find(x=>x.id===postId);
    try{await updateDoc(doc(db,"posts",postId),{commentsCount:(p?.commentsCount||0)+1});}catch(e){}
    if(p && p.uid && p.uid!==currentUser.uid && typeof createActivity==="function"){
      try{await createActivity("comment","commented on your post",p.uid,{postId});}catch(e){}
    }
    const box=findCommentBox(postId, boxKey);
    if(box){box.classList.remove("hidden");box.style.display="block";}
    listenPostComments(postId, boxKey);
  }catch(error){
    console.error("Comment send error:", error);
    alert("Comment was not sent. Check Firestore comments rules.");
  }
};


window.toggleLike = async function(postId){
  const p=allPosts.find(x=>x.id===postId); if(!p||!currentUser)return;
  let likes=Array.isArray(p.likes)?p.likes:[];
  const was=likes.includes(currentUser.uid);
  if(was) likes=likes.filter(x=>x!==currentUser.uid); else likes.push(currentUser.uid);
  await updateDoc(doc(db,"posts",postId),{likes});
  if(!was && p.uid!==currentUser.uid) await createActivity("like","liked your post",p.uid,{postId});
};

window.createPostFromHome = async function(){
  try{
    if(!currentUser) return alert("Please login first.");
    const home=document.getElementById("homePostText");
    const text=(home?.value||"").trim();
    if(!text) return alert("Write something first.");
    const postBox=document.getElementById("postText");
    if(postBox)postBox.value=text;
    await createPost();
    if(home)home.value="";
    renderPosts();
  }catch(err){
    console.error("home post failed",err);
    alert("Post failed: "+(err.message||err));
  }
};

window.toggleSavePost = async function(postId){
  const p = allPosts.find(x=>x.id===postId);
  if(!p || !currentUser) return;
  let savedBy = Array.isArray(p.savedBy)?p.savedBy:[];
  if(savedBy.includes(currentUser.uid)) savedBy = savedBy.filter(x=>x!==currentUser.uid);
  else savedBy.push(currentUser.uid);
  await updateDoc(doc(db,"posts",postId),{savedBy});
};

window.sharePost = function(postId){
  const p = allPosts.find(x=>x.id===postId);
  if(!p) return;
  const text = "Kalb Message Post by " + (p.name||"User") + ": " + (p.text||"");
  navigator.clipboard.writeText(text).then(()=>alert("Post copied for sharing."));
};

window.reportPost = async function(postId){
  if(!currentUser) return;
  await addDoc(collection(db,"reports"),{type:"post",postId,uid:currentUser.uid,email:currentUser.email||"",createdAt:serverTimestamp()});
  alert("Post reported.");
};

window.editPost = async function(postId){
  const p = allPosts.find(x=>x.id===postId);
  if(!p || p.uid!==currentUser.uid) return;
  const text = prompt("Edit your post:", p.text||"");
  if(text!==null && text.trim()) await updateDoc(doc(db,"posts",postId),{text:text.trim(),editedAt:serverTimestamp()});
};

window.deletePost = async function(postId){
  if(confirm("Delete this post?")) await deleteDoc(doc(db,"posts",postId));
};

window.toggleComments = async function(postId){
  const box = document.getElementById("comments_"+postId);
  box.classList.toggle("hidden");
  if(!box.classList.contains("hidden")) loadComments(postId);
};

async function loadComments(postId){
  const q = query(collection(db,"posts",postId,"comments"), orderBy("createdAt","asc"));
  const snapshot = await getDocs(q);
  const list = document.getElementById("commentsList_"+postId);
  if(!list) return;
  list.innerHTML = "";
  snapshot.forEach(d=>{
    const c = d.data();
    const canDelete = currentUser && c.uid === currentUser.uid;
    list.innerHTML += `<div class="comment"><b>${safe(c.name||"User")}:</b> ${safe(c.text||"")} ${canDelete?`<button class="toolbtn" onclick='deleteComment("${postId}","${d.id}")'>Delete</button>`:""}</div>`;
  });
}

window.addComment = async function(postId){
  const input=document.getElementById("commentInput_"+postId); const text=input.value.trim(); if(!text)return;
  const meSnap=await getDoc(doc(db,"users",currentUser.uid)); const me=meSnap.exists()?meSnap.data():{};
  await addDoc(collection(db,"posts",postId,"comments"),{text,uid:currentUser.uid,name:me.name||currentUser.displayName||"User",createdAt:serverTimestamp()});
  const p=allPosts.find(x=>x.id===postId); await updateDoc(doc(db,"posts",postId),{commentsCount:(p?.commentsCount||0)+1});
  input.value=""; if(p && p.uid!==currentUser.uid) await createActivity("comment","commented on your post",p.uid,{postId});
};

window.deleteComment = async function(postId,commentId){
  if(confirm("Delete comment?")) await deleteDoc(doc(db,"posts",postId,"comments",commentId));
};



function isAdminUser(){
  return currentUser && (currentUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function listenReports(){
  onSnapshot(collection(db,"reports"),function(snapshot){
    allReports = [];
    snapshot.forEach(d=>allReports.push({id:d.id,...d.data()}));
    allReports.sort((a,b)=>{
      const aa=a.createdAt&&a.createdAt.seconds?a.createdAt.seconds:0;
      const bb=b.createdAt&&b.createdAt.seconds?b.createdAt.seconds:0;
      return bb-aa;
    });
    renderAdminPanel();
  },function(e){console.error(e)});
}

function listenAnnouncements(){
  const q = query(collection(db,"announcements"), orderBy("createdAt","desc"));
  onSnapshot(q,function(snapshot){
    allAnnouncements = [];
    snapshot.forEach(d=>allAnnouncements.push({id:d.id,...d.data()}));
    renderLatestAnnouncement();
  },function(e){console.error(e)});
}

function renderLatestAnnouncement(){
  const latest = allAnnouncements[0];
  let old = document.getElementById("latestAnnouncementCard");
  if(old) old.remove();
  if(!latest || !homePage) return;
  const div = document.createElement("div");
  div.className = "card";
  div.id = "latestAnnouncementCard";
  div.innerHTML = `<h3>📢 Admin Announcement</h3><p class="post-text">${safe(latest.text||"")}</p><p class="muted">${formatDate(latest.createdAt)}</p>`;
  const first = homePage.querySelector(".card");
  if(first && first.nextSibling) homePage.insertBefore(div, first.nextSibling);
}

window.renderAdminPanel = function(){
  if(!document.getElementById("adminPage")) return;
  if(!isAdminUser()){
    if(adminUsersBox) adminUsersBox.innerHTML = '<p class="muted">Admin only.</p>';
    return;
  }

  if(adminUsersBox){
    adminUsersBox.innerHTML = allUsers.length ? allUsers.map(u=>`
      <div class="admin-item">
        <b>${safe(u.name||"User")}</b>
        <p class="muted">@${safe(u.username||"user")} • ${safe(u.email||"")}</p>
        <p class="muted">Status: ${u.banned?'Banned':'Active'}</p>
        <div class="admin-actions">
          <button class="btn small ${u.banned?'green':'red'}" onclick='toggleBanUser("${u.uid}", ${u.banned?'false':'true'})'>${u.banned?'Unban':'Ban'}</button>
        </div>
      </div>`).join("") : '<p class="muted">No users found.</p>';
  }

  if(adminReportsBox){
    adminReportsBox.innerHTML = allReports.length ? allReports.map(r=>`
      <div class="admin-item">
        <b>${safe(r.type||"report")}</b>
        <p class="muted">By: ${safe(r.email||r.uid||"unknown")}</p>
        <p class="muted">Post: ${safe(r.postId||"")}</p>
        <div class="admin-actions">
          ${r.postId?`<button class="btn small red" onclick='adminDeletePost("${r.postId}")'>Delete Reported Post</button>`:""}
          <button class="btn small" onclick='adminDeleteReport("${r.id}")'>Clear Report</button>
        </div>
      </div>`).join("") : '<p class="muted">No reports.</p>';
  }

  if(adminPostsBox){
    adminPostsBox.innerHTML = allPosts.length ? allPosts.map(p=>`
      <div class="admin-item">
        <b>${safe(p.name||"User")}</b>
        <p>${safe(p.text||"")}</p>
        <p class="muted">${safe(p.email||"")}</p>
        <button class="btn small red" onclick='adminDeletePost("${p.id}")'>Delete Post</button>
      </div>`).join("") : '<p class="muted">No posts.</p>';
  }

  if(adminGroupsBox){
    adminGroupsBox.innerHTML = allGroups.length ? allGroups.map(g=>`
      <div class="admin-item">
        <b>${safe(g.name||"Group")}</b>
        <p class="muted">${(g.members||[]).length} members • Admin: ${safe(g.adminName||"User")}</p>
        <button class="btn small red" onclick='adminDeleteGroup("${g.id}")'>Delete Group</button>
      </div>`).join("") : '<p class="muted">No groups.</p>';
  }
};

window.toggleBanUser = async function(uid,banned){
  if(!isAdminUser()) return alert("Admin only.");
  await setDoc(doc(db,"users",uid),{banned:banned},{merge:true});
  renderAdminPanel();
};

window.adminDeletePost = async function(postId){
  if(!isAdminUser()) return alert("Admin only.");
  if(confirm("Delete this post?")) await deleteDoc(doc(db,"posts",postId));
};

window.adminDeleteGroup = async function(groupId){
  if(!isAdminUser()) return alert("Admin only.");
  if(confirm("Delete this group?")) await deleteDoc(doc(db,"groups",groupId));
};

window.adminDeleteReport = async function(reportId){
  if(!isAdminUser()) return alert("Admin only.");
  await deleteDoc(doc(db,"reports",reportId));
};

window.sendAnnouncement = async function(){
  if(!isAdminUser()) return alert("Admin only.");
  const text = announcementText.value.trim();
  if(!text) return showStatus("adminStatus","Write announcement first.",true);
  await addDoc(collection(db,"announcements"),{
    text,
    adminEmail: currentUser.email,
    createdAt: serverTimestamp()
  });
  announcementText.value = "";
  showStatus("adminStatus","Announcement sent.");
};







/* === CALL FRIENDS ONLINE FALLBACK FIX ===
   Fixes: isReallyOnline is not defined
   Keeps call page friends-only and prevents the whole call list from crashing.
*/
if (typeof window.isReallyOnline !== "function") {
  window.isReallyOnline = function(uid){
    try{
      if(!uid) return false;
      const data = (typeof onlineMap !== "undefined" && onlineMap) ? onlineMap[uid] : null;
      if(!data) return false;
      if(data.online === true) return true;
      const last = data.lastSeen || data.updatedAt || data.time || data.timestamp;
      let ms = 0;
      if(last && typeof last.toMillis === "function") ms = last.toMillis();
      else if(last && last.seconds) ms = last.seconds * 1000;
      else if(typeof last === "number") ms = last;
      return ms ? (Date.now() - ms < 120000) : false;
    }catch(e){ return false; }
  };
}
function callIsOnlineSafe(uid){
  try{
    if(typeof isReallyOnline === "function") return !!isReallyOnline(uid);
    if(typeof window.isReallyOnline === "function") return !!window.isReallyOnline(uid);
  }catch(e){}
  return false;
}

function getEl(id){ return document.getElementById(id); }

function getHiddenCallFriendIds(){
  try{ return JSON.parse(localStorage.getItem('kalb_hidden_call_friends')||'[]'); }catch(e){ return []; }
}
function setHiddenCallFriendIds(ids){
  try{ localStorage.setItem('kalb_hidden_call_friends', JSON.stringify([...new Set(ids)].filter(Boolean))); }catch(e){}
}
window.deleteCallFriendFromList=function(uid){
  if(!uid) return;
  const ids=getHiddenCallFriendIds();
  if(!ids.includes(uid)) ids.push(uid);
  setHiddenCallFriendIds(ids);
  renderCallUsersList();
  alert('Removed from call list. This only hides the user from your Friends to Call list.');
};
window.restoreCallFriendList=function(){
  setHiddenCallFriendIds([]);
  renderCallUsersList();
};

function callUsersHtml(u){
  const isMe=currentUser && u.uid===currentUser.uid;
  const online=callIsOnlineSafe(u.uid) && !u.hideOnline;
  const name=safe(u.name||u.displayName||u.email||"User");
  const uname=safe(u.username||((u.email||"user").split("@")[0])||"user");
  const avatar=safe(u.avatarEmoji||initials(u.name,u.email));
  const verified=u.verified?'<span class="badge-verified">✓</span>':'';
  return `<div class="call-friend-card">
    <div class="avatar" style="background:${avatarStyle(u.avatarColor)}">${avatar}</div>
    <div style="min-width:0">
      <p class="call-friend-name">${name} ${verified}</p>
      <div class="call-friend-sub"><span class="presence-dot ${online?'online':''}"></span><span>${online?'Online':'Offline'}</span><span>@${uname}</span></div>
    </div>
    ${isMe?`<span class="muted">You</span>`:`<div class="call-actions"><button class="btn small video-btn" onclick='requestCallToUser("${u.uid}",true)'>📹 Video</button><button class="btn small voice-btn" onclick='requestCallToUser("${u.uid}",false)'>🎙️ Voice</button><button class="btn small danger" onclick='deleteCallFriendFromList("${u.uid}")'>Delete</button></div>`}
  </div>`;
}
window.renderCallUsersList=async function(){
  const listBox=document.getElementById('callUsersList');
  if(!listBox) return;
  if(!currentUser){
    listBox.innerHTML='<div class="empty-state"><h3>Login first</h3><p>Please login to see friends.</p></div>';
    const fc=document.getElementById('callFriendsCount'), oc=document.getElementById('callOnlineCount');
    if(fc) fc.innerText='0'; if(oc) oc.innerText='0';
    return;
  }
  listBox.innerHTML='<div class="empty-state"><h3>Loading friends...</h3><p>Please wait.</p></div>';
  try{
    // Load users from Firestore using module variables, not old global allUsers.
    if(typeof reloadAllUsersFinal==='function') await reloadAllUsersFinal();
    else{
      const snap=await getDocs(collection(db,'users'));
      allUsers=[]; snap.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
    }

    let ids=[];
    if(typeof getAcceptedFriendIdsFinal==='function') ids=await getAcceptedFriendIdsFinal();
    else{
      const me=currentUser.uid;
      const set=new Set();
      const mine=(currentUserProfile&&Array.isArray(currentUserProfile.friends))?currentUserProfile.friends:[];
      mine.forEach(id=>id&&id!==me&&set.add(id));
      (allUsers||[]).forEach(u=>{ if(u.uid!==me && Array.isArray(u.friends) && u.friends.includes(me)) set.add(u.uid); });
      try{
        const reqSnap=await getDocs(collection(db,'friendRequests'));
        reqSnap.forEach(d=>{
          const r=d.data()||{}; if(r.status!=='accepted') return;
          const from=r.from||r.fromUid||r.senderId; const to=r.to||r.toUid||r.receiverId;
          if(from===me&&to) set.add(to); if(to===me&&from) set.add(from);
        });
      }catch(err){ console.warn('friendRequests fallback failed',err); }
      ids=[...set];
    }

    const userMap=new Map((allUsers||[]).map(u=>[u.uid,u]));
    let friends=ids.map(id=>userMap.get(id)).filter(Boolean);
    const hiddenCallIds = new Set(getHiddenCallFriendIds());
    friends = friends.filter(u => u && !hiddenCallIds.has(u.uid));
    const q=(document.getElementById('callUserSearch')?.value||'').toLowerCase().trim();
    if(q){ friends=friends.filter(u=>(((u.name||'')+' '+(u.displayName||'')+' '+(u.username||'')+' '+(u.email||'')).toLowerCase()).includes(q)); }

    const onlineFriends=friends.filter(u=>callIsOnlineSafe(u.uid)&&!u.hideOnline).length;
    const fc=document.getElementById('callFriendsCount'), oc=document.getElementById('callOnlineCount');
    if(fc) fc.innerText=String(friends.length); if(oc) oc.innerText=String(onlineFriends);

    if(!friends.length){
      listBox.innerHTML='<div class="empty-state"><h3>No accepted friends found</h3><p>Only users with accepted friend requests will show here. If you deleted someone by mistake, tap restore.</p><button class="btn small" onclick="restoreCallFriendList()">Restore hidden users</button></div>';
      return;
    }

    listBox.innerHTML=friends.map(u=>{
      const online=callIsOnlineSafe(u.uid)&&!u.hideOnline;
      const nm=safe(u.name||u.displayName||u.email||'User');
      const un=safe(u.username||((u.email||'user').split('@')[0])||'user');
      return `<div class="call-user-card ${online?'online-friend':''}">
        <div class="call-avatar" style="background:${avatarStyle(u.avatarColor)}">${safe(u.avatarEmoji||initials(u.name,u.email))}</div>
        <div class="call-user-meta">
          <h3>${nm} ${u.verified?'<span class="badge-verified">✓</span>':''}</h3>
          <p><span class="online-dot ${online?'on':'off'}"></span>${online?'Online':'Offline'} • @${un}</p>
        </div>
        <div class="call-actions">
          <button class="btn small call-video" onclick='startDirectCall("${u.uid}","video")'>Video</button>
          <button class="btn small call-voice" onclick='startDirectCall("${u.uid}","voice")'>Voice</button>
          <button class="btn small danger" onclick='deleteCallFriendFromList("${u.uid}")'>Delete</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    console.error('call friends load failed',e);
    listBox.innerHTML=`<div class="empty-state"><h3>Could not load friends</h3><p>${safe(e.message||e)}</p></div>`;
    const fc=document.getElementById('callFriendsCount'), oc=document.getElementById('callOnlineCount');
    if(fc) fc.innerText='0'; if(oc) oc.innerText='0';
  }
};



// Direct call buttons now use this stable wrapper.
window.startDirectCall = async function(uid, type){
  const isVideo = String(type||'video').toLowerCase() === 'video';
  return window.requestCallToUser(uid, isVideo);
};

window.requestCallToUser=async function(uid, videoEnabled=true){
  try{
    if(!currentUser)return alert("Login first.");
    const target=allUsers.find(u=>u.uid===uid);
    if(!target)return alert("User not found.");
    await createRoom(videoEnabled, false);
    const meSnap=await getDoc(doc(db,"users",currentUser.uid));
    const me=meSnap.exists()?meSnap.data():{};
    await addDoc(collection(db,"callRequests"),{
      roomId: currentRoomId,
      callType: videoEnabled?"video":"voice",
      fromUid:currentUser.uid,
      fromName:me.name||currentUser.displayName||"User",
      fromEmail:currentUser.email||"",
      toUid:uid,
      toName:target.name||target.email||"User",
      status:"ringing",
      createdAt:serverTimestamp()
    });
    openPage("callsPage");
    callMsg((videoEnabled?"Video":"Voice")+" call sent to "+(target.name||target.email||"user")+". Waiting for answer... Room ID: "+currentRoomId);
  }catch(e){console.error(e);alert("Call failed: "+(e.message||e));}
};

function listenCallRequests(){
  if(!currentUser)return;
  if(unsubscribeCallRequests)unsubscribeCallRequests();
  if(unsubscribeOutgoingCalls)unsubscribeOutgoingCalls();
  const incoming=query(collection(db,"callRequests"),where("toUid","==",currentUser.uid));
  unsubscribeCallRequests=onSnapshot(incoming,function(snapshot){
    const rows=[];
    snapshot.forEach(d=>{const c=d.data(); if(c.status==="ringing")rows.push({id:d.id,...c});});
    const box=getEl("realCallRequestsBox");
    if(!box)return;
    box.innerHTML=rows.map(c=>`<div class="call-request">
      <b>Incoming ${safe(c.callType||"video")} call from ${safe(c.fromName||"User")}</b>
      <p class="muted">Room: ${safe(c.roomId||"")} • ${safe(c.fromEmail||"")}</p>
      <div class="actions">
        <button class="btn small green" onclick='acceptCallRequest("${c.id}")'>Accept</button>
        <button class="btn small red" onclick='rejectCallRequest("${c.id}")'>Reject</button>
      </div>
    </div>`).join("");
    if(rows.length){
      document.getElementById("incomingCallBox")?.classList.add("active");
      incomingCallText.innerText="Incoming call from "+(rows[0].fromName||"User");
    } else document.getElementById("incomingCallBox")?.classList.remove("active");
  },function(e){console.error(e);});

  const outgoing=query(collection(db,"callRequests"),where("fromUid","==",currentUser.uid));
  unsubscribeOutgoingCalls=onSnapshot(outgoing,function(snapshot){
    snapshot.docChanges().forEach(ch=>{
      const c=ch.doc.data();
      if(c.status==="rejected") callMsg("Call rejected by "+(c.toName||"user"), true);
      if(c.status==="accepted") callMsg("Call accepted. Connecting room: "+(c.roomId||currentRoomId));
    });
  },function(e){console.error(e);});
}

window.acceptCallRequest=async function(id){
  try{
    const ref=doc(db,"callRequests",id);
    const snap=await getDoc(ref);
    if(!snap.exists()) return alert("Call request not found.");
    const c=snap.data();
    await updateDoc(ref,{status:"accepted",acceptedAt:serverTimestamp()});
    document.getElementById("incomingCallBox")?.classList.remove("active");
    openPage("callsPage");
    if(c.roomId){
      callRoomId.value=String(c.roomId).toUpperCase();
      await joinCallRoom();
    } else {
      callMsg("Accepted, but Room ID is missing. Ask caller to create room again.", true);
    }
  }catch(e){console.error(e);alert("Accept failed: "+(e.message||e));}
};
window.rejectCallRequest=async function(id){
  try{await updateDoc(doc(db,"callRequests",id),{status:"rejected",rejectedAt:serverTimestamp()});document.getElementById("incomingCallBox")?.classList.remove("active");}
  catch(e){alert("Reject failed: "+(e.message||e));}
};

function callMsg(text,error=false){
  callStatus.className="notice "+(error?"err":"");
  callStatus.innerText=text;
}
function startCallTimer(){
  callStartTime = Date.now();
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(function(){
    const s = Math.floor((Date.now()-callStartTime)/1000);
    const m = String(Math.floor(s/60)).padStart(2,"0");
    const sec = String(s%60).padStart(2,"0");
    callTimer.innerText = "Call timer: " + m + ":" + sec;
  },1000);
}
function stopCallTimer(){
  clearInterval(callTimerInterval);
  callTimerInterval = null;
}
function addCallHistory(type,status){
  const h = JSON.parse(localStorage.getItem("kalbCallHistory")||"[]");
  h.unshift({type,status,time:new Date().toLocaleString(),room:currentRoomId||""});
  localStorage.setItem("kalbCallHistory",JSON.stringify(h.slice(0,20)));
  renderCallHistory();
}
window.renderCallHistory = function(){
  const box = document.getElementById("callHistoryBox");
  if(!box) return;
  const h = JSON.parse(localStorage.getItem("kalbCallHistory")||"[]");
  box.innerHTML = h.length ? h.map(x=>`<div class="call-history-item"><b>${safe(x.type)}</b> • ${safe(x.status)}<br><span class="muted">${safe(x.time)} ${x.room?("• Room "+safe(x.room)):""}</span></div>`).join("") : "<p class='muted'>No calls yet.</p>";
};
window.fakeIncomingCall = function(){
  document.getElementById("incomingCallBox")?.classList.add("active");
  incomingCallText.innerText = "Incoming call from Test User";
  addCallHistory("Incoming","Ringing");
};
window.acceptIncomingCall = async function(){
  try{
    const qSnap = await getDocs(query(collection(db,"callRequests"),where("toUid","==",currentUser.uid),where("status","==","ringing")));
    if(!qSnap.empty){ return acceptCallRequest(qSnap.docs[0].id); }
  }catch(e){console.error(e)}
  document.getElementById("incomingCallBox")?.classList.remove("active");
  callMsg("Incoming call accepted. Paste a Room ID or ask the caller to call again.");
  startCallTimer();
  addCallHistory("Incoming","Accepted");
};
window.rejectIncomingCall = function(){
  document.getElementById("incomingCallBox")?.classList.remove("active");
  callMsg("Incoming call rejected.");
  addCallHistory("Incoming","Rejected");
};
async function prepareCall(videoEnabled){
  if(!currentUser)throw new Error("Please login first.");
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("Your browser does not support camera/microphone calls.");
  await hangupCall(false);

  const localVideoEl = document.getElementById("localVideo");
  const remoteVideoEl = document.getElementById("remoteVideo");
  const muteButton = document.getElementById("muteBtn");
  const cameraButton = document.getElementById("cameraBtn");

  localStream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true},
    video: videoEnabled ? {facingMode:"user"} : false
  });
  localStream.getAudioTracks().forEach(t=>{ t.enabled = true; });
  remoteStream=new MediaStream();
  attachRemoteOutput(remoteStream);

  if(localVideoEl){
    localVideoEl.muted=true;
    localVideoEl.playsInline=true;
    localVideoEl.srcObject=localStream;
    localVideoEl.play().catch(()=>{});
  }
  if(remoteVideoEl){
    remoteVideoEl.muted=false;
    remoteVideoEl.volume=1;
    remoteVideoEl.playsInline=true;
    remoteVideoEl.autoplay=true;
    remoteVideoEl.srcObject=remoteStream;
  }
  attachRemoteOutput(remoteStream);

  pc=new RTCPeerConnection(rtcServers);
  localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));

  pc.ontrack=function(event){
    const incomingStream = event.streams && event.streams[0] ? event.streams[0] : remoteStream;
    if(event.track && incomingStream && !incomingStream.getTracks().includes(event.track)){
      incomingStream.addTrack(event.track);
    }
    attachRemoteOutput(incomingStream);
    playRemoteOutput().catch(()=>{
      callMsg("Call connected. Tap anywhere once to enable speaker sound.");
    });
  };

  pc.onconnectionstatechange=function(){
    if(!pc) return;
    if(pc.connectionState==="connected"){
      keepLocalMicLive();
      playRemoteOutput();
      callMsg("Connected. Mic and speaker are active.");
    }
    else callMsg("Call status: "+pc.connectionState);
  };
  pc.oniceconnectionstatechange=function(){
    if(pc && (pc.iceConnectionState==="failed" || pc.iceConnectionState==="disconnected")){
      callMsg("Connection issue. Keep both phones on the call page and try again if audio/video does not start.", true);
    }
  };

  if(muteButton) muteButton.innerText="🎙️ Mute Mic";
  if(cameraButton) cameraButton.innerText=videoEnabled?"📷 Camera Off":"Voice Only";
}
async function createRoom(videoEnabled, showFinalAlert=true){
  try{
    await prepareCall(videoEnabled);
    currentRoomId=Math.random().toString(36).slice(2,8).toUpperCase();
    callRoomId.value=currentRoomId;
    currentRoomRef=doc(db,"calls",currentRoomId);
    const callerCandidates=collection(currentRoomRef,"callerCandidates");
    const calleeCandidates=collection(currentRoomRef,"calleeCandidates");
    pc.onicecandidate=function(event){if(event.candidate)addDoc(callerCandidates,event.candidate.toJSON())};
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(currentRoomRef,{roomId:currentRoomId,video:videoEnabled,createdBy:currentUser.uid,createdByEmail:currentUser.email||"",offer:{type:offer.type,sdp:offer.sdp},createdAt:serverTimestamp()});
    const unsubRoom=onSnapshot(currentRoomRef,async function(snapshot){
      const data=snapshot.data();
      if(!pc||!data)return;
      if(!pc.currentRemoteDescription&&data.answer){await pc.setRemoteDescription(new RTCSessionDescription(data.answer));callMsg("Connected. Room ID: "+currentRoomId)}
    });
    const unsubCandidates=onSnapshot(calleeCandidates,function(snapshot){
      snapshot.docChanges().forEach(function(change){if(change.type==="added"&&pc)pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error)});
    });
    callUnsubs.push(unsubRoom,unsubCandidates);
    callMsg(showFinalAlert?"Room created. Share this Room ID: "+currentRoomId:"Room created for direct call. Waiting for receiver...");
    startCallTimer();
    addCallHistory(videoEnabled?"Video Call":"Voice Call","Created");
  }catch(e){console.error(e);callMsg(e.message||"Call create failed.",true)}
}
window.createVideoCall=function(){createRoom(true)}
window.createVoiceCall=function(){createRoom(false)}
window.joinCallRoom=async function(){
  try{
    if(!currentUser)return callMsg("Please login first.",true);
    currentRoomId=callRoomId.value.trim().toUpperCase();
    if(!currentRoomId)return callMsg("Enter a Room ID first.",true);
    currentRoomRef=doc(db,"calls",currentRoomId);
    const roomSnapshot=await getDoc(currentRoomRef);
    if(!roomSnapshot.exists())return callMsg("Room not found. Check the Room ID.",true);
    const roomData=roomSnapshot.data();
    await prepareCall(roomData.video!==false);
    const callerCandidates=collection(currentRoomRef,"callerCandidates");
    const calleeCandidates=collection(currentRoomRef,"calleeCandidates");
    pc.onicecandidate=function(event){if(event.candidate)addDoc(calleeCandidates,event.candidate.toJSON())};
    await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(currentRoomRef,{joinedBy:currentUser.uid,joinedByEmail:currentUser.email||"",answer:{type:answer.type,sdp:answer.sdp},joinedAt:serverTimestamp()});
    const unsubCandidates=onSnapshot(callerCandidates,function(snapshot){
      snapshot.docChanges().forEach(function(change){if(change.type==="added"&&pc)pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error)});
    });
    callUnsubs.push(unsubCandidates);
    callMsg("Joined room: "+currentRoomId);
    startCallTimer();
    addCallHistory("Call","Joined");
  }catch(e){console.error(e);callMsg(e.message||"Join call failed.",true)}
}
window.toggleMute=function(){
  if(!localStream)return callMsg("Start or join a call first.",true);
  const tracks=localStream.getAudioTracks();
  if(!tracks.length)return callMsg("No microphone found.",true);
  tracks.forEach(t=>t.enabled=!t.enabled);
  const mb=document.getElementById("muteBtn");
  if(mb) mb.innerText=tracks[0].enabled?"🎙️ Mute Mic":"🔇 Unmute Mic";
  callMsg(tracks[0].enabled?"Microphone is ON. Other user can hear you.":"Microphone is muted.");
}
window.toggleCamera=function(){
  if(!localStream)return callMsg("Start or join a video call first.",true);
  const tracks=localStream.getVideoTracks();
  if(!tracks.length)return callMsg("This is a voice call. No camera track.",true);
  tracks.forEach(t=>t.enabled=!t.enabled);
  const cb=document.getElementById("cameraBtn");
  if(cb) cb.innerText=tracks[0].enabled?"📷 Camera Off":"📷 Camera On";
}
window.hangupCall=async function(showMessage=true){
  callUnsubs.forEach(unsub=>{try{unsub()}catch(e){}});
  callUnsubs=[];
  if(pc){pc.close();pc=null}
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}
  if(remoteStream){remoteStream.getTracks().forEach(t=>t.stop());remoteStream=null}
  const lv=document.getElementById("localVideo"), rv=document.getElementById("remoteVideo"), ra=document.getElementById("kalbRemoteAudio");
  if(lv)lv.srcObject=null;
  if(rv)rv.srcObject=null;
  if(ra)ra.srcObject=null;
  stopCallTimer();
  if(showMessage){callMsg("Call ended.");addCallHistory("Call","Ended");}
}
window.quickCall=function(name){
  openPage("callsPage");
  callMsg("Call page opened for "+name+". Create a room and share the Room ID.");
}


window.forceRemoteCallSound=function(){
  playRemoteOutput();
  keepLocalMicLive();
  callMsg("Speaker enabled. Mic is ON.");
};

// ===== Visible social features: requests, block, privacy, theme, reset, ticks =====
function userById(uid){return (allUsers||[]).find(u=>u.uid===uid)||{}}
function socialIsFriend(uid){return ((currentUserProfile&&currentUserProfile.friends)||[]).includes(uid)}
function socialIsBlocked(uid){return ((currentUserProfile&&currentUserProfile.blockedUsers)||[]).includes(uid)}
function socialHasBlockedMe(uid){return ((userById(uid).blockedUsers)||[]).includes(currentUser?.uid)}
function canMessageSocial(uid){
  if(!currentUser || !uid)return false;
  if(socialIsBlocked(uid) || socialHasBlockedMe(uid))return false;
  const other=userById(uid);
  if(other.friendsOnlyMessages && !socialIsFriend(uid))return false;
  return true;
}
function verifiedHtml(u){return u&&u.verified?'<span class="badge-verified">✓</span>':''}
function applySocialTheme(){
  const t=localStorage.getItem("kalbSocialTheme") || currentUserProfile?.socialTheme || "";
  if(t){document.body.classList.remove("kalb-blue","kalb-purple","kalb-green","kalb-gold","kalb-red");document.body.classList.add(t)}
  const w=localStorage.getItem("kalbWallpaper") || currentUserProfile?.chatWallpaper || "";
  if(w)document.documentElement.style.setProperty("--chat-wallpaper",w);
}
window.setSocialTheme=async function(theme){
  document.body.classList.remove("kalb-blue","kalb-purple","kalb-green","kalb-gold","kalb-red");
  document.body.classList.add(theme);
  localStorage.setItem("kalbSocialTheme",theme);
  if(currentUser)try{await updateDoc(doc(db,"users",currentUser.uid),{socialTheme:theme})}catch(e){}
};
window.saveChatWallpaper=async function(){
  const v=(document.getElementById("wallpaperInput")?.value||"").trim();
  if(!v)return alert("Enter a wallpaper color or CSS background.");
  document.documentElement.style.setProperty("--chat-wallpaper",v);
  localStorage.setItem("kalbWallpaper",v);
  if(currentUser)try{await updateDoc(doc(db,"users",currentUser.uid),{chatWallpaper:v})}catch(e){}
  alert("Wallpaper saved.");
};
window.savePrivacySetting=async function(key,value){
  if(!currentUser)return alert("Login first.");
  await updateDoc(doc(db,"users",currentUser.uid),{[key]:value});
  currentUserProfile={...(currentUserProfile||{}),[key]:value};
  const s=document.getElementById("privacyStatus");
  if(s)s.innerText=key+" set to "+value;
  alert("Privacy updated.");
};
window.sendResetEmail=async function(){
  const email=(document.getElementById("resetEmailInput")?.value||currentUser?.email||"").trim();
  if(!email)return alert("Enter email.");
  await sendPasswordResetEmail(auth,email);
  alert("Password reset email sent.");
};
window.sendFriendRequest=async function(uid){
  if(!currentUser)return alert("Login first.");
  if(uid===currentUser.uid)return;
  if(socialIsFriend(uid))return alert("Already friends.");
  await setDoc(doc(db,"friendRequests",currentUser.uid+"_"+uid),{
    from:currentUser.uid,to:uid,status:"pending",
    fromName:currentUserProfile?.name||currentUser.displayName||currentUser.email||"User",
    fromEmail:currentUser.email||"",createdAt:serverTimestamp()
  },{merge:true});
  alert("Friend request sent.");
};
window.acceptFriendRequest=async function(reqId,fromUid){
  await updateDoc(doc(db,"friendRequests",reqId),{status:"accepted",acceptedAt:serverTimestamp()});
  await updateDoc(doc(db,"users",currentUser.uid),{friends:arrayUnion(fromUid)});
  await updateDoc(doc(db,"users",fromUid),{friends:arrayUnion(currentUser.uid)});
  await loadProfile();
  try{renderFriendRequests()}catch(e){}
  try{renderUsers()}catch(e){}
  try{renderFriendsList()}catch(e){}
  alert("Friend request accepted.");
};
window.rejectFriendRequest=async function(id){
  await updateDoc(doc(db,"friendRequests",id),{status:"rejected",updatedAt:serverTimestamp()});
  renderFriendRequests();
};
window.renderFriendRequests=async function(){
  const box=document.getElementById("friendRequestsBox");
  if(!box||!currentUser)return;
  box.innerHTML='<p class="muted">Loading requests...</p>';
  try{
    const q=query(collection(db,"friendRequests"),where("to","==",currentUser.uid),where("status","==","pending"));
    const snap=await getDocs(q);
    if(snap.empty){box.innerHTML='<p class="muted">No incoming friend requests.</p>';return;}
    box.innerHTML=snap.docs.map(d=>{
      const r=d.data();
      return `<div class="request-card"><b>${safe(r.fromName||r.fromEmail||"User")}</b><p class="muted">wants to be your friend</p>
        <button class="btn small green" onclick='acceptFriendRequest("${d.id}","${r.from}")'>Accept</button>
        <button class="btn small red" onclick='rejectFriendRequest("${d.id}")'>Reject</button></div>`;
    }).join("");
  }catch(e){console.error(e);box.innerHTML='<p class="muted">Friend requests need updated Firestore rules.</p>'}
};
window.blockUser=async function(uid){
  if(!currentUser||!uid)return;
  if(!confirm("Block this user?"))return;
  await updateDoc(doc(db,"users",currentUser.uid),{blockedUsers:arrayUnion(uid)});
  await loadProfile();
  alert("User blocked.");
  renderUsers();
};
window.unblockUser=async function(uid){
  if(!currentUser||!uid)return;
  await updateDoc(doc(db,"users",currentUser.uid),{blockedUsers:arrayRemove(uid)});
  await loadProfile();
  alert("User unblocked.");
  renderUsers();
};
window.reportProfile=async function(uid){
  const reason=prompt("Why are you reporting this profile?");
  if(!reason)return;
  await addDoc(collection(db,"reports"),{type:"profile",targetUid:uid,reason,uid:currentUser.uid,email:currentUser.email||"",createdAt:serverTimestamp(),status:"open"});
  alert("Profile reported.");
};
window.reportCurrentChat=async function(){
  if(!currentUser||!currentChatId)return alert("Open a chat first.");
  const reason=prompt("Why are you reporting this chat?");
  if(!reason)return;
  await addDoc(collection(db,"reports"),{type:"chat",chatId:currentChatId,targetUid:currentChatUser?.uid||"",reason,uid:currentUser.uid,email:currentUser.email||"",createdAt:serverTimestamp(),status:"open"});
  alert("Chat reported.");
};
window.verifyUserAdmin=async function(uid){
  if(!isAppAdmin())return alert("Only admin.");
  await updateDoc(doc(db,"users",uid),{verified:true});
  alert("Verified badge added.");
};
window.unverifyUserAdmin=async function(uid){
  if(!isAppAdmin())return alert("Only admin.");
  await updateDoc(doc(db,"users",uid),{verified:false});
  alert("Verified badge removed.");
};

// Override users render so the features are visible in + Search and Users page
window.renderUsers=function(){
  const q1=(document.getElementById("userSearch")?.value||"").toLowerCase();
  const q2=(document.getElementById("globalSearchInput")?.value||"").toLowerCase();
  const q=(q2||q1||"").toLowerCase();
  let list=(allUsers||[]).filter(u=>u.uid!==currentUser?.uid);
  list=list.filter(u=>(((u.name||"")+" "+(u.username||"")+" "+(u.email||"")).toLowerCase()).includes(q));
  const htmlList=!list.length?'<div class="card empty">No users found.</div>':list.map(u=>{
    const online=canShowOnlineForUser(u)&&onlineMap[u.uid];
    const friend=socialIsFriend(u.uid);
    const blocked=socialIsBlocked(u.uid);
    const canMsg=canMessageSocial(u.uid);
    return `<div class="card user-row ${blocked?'blocked-user':''}">
      <div class="avatar" style="background:${avatarStyle(u.avatarColor)}">${safe(u.avatarEmoji||initials(u.name,u.email))}</div>
      <div class="user-info">
        <h3>${safe(u.name||"User")} ${verifiedHtml(u)} ${online?'<span class="online-dot"></span>':(u.hideOnline?'<span class="hidden-online-badge">Hidden</span>':'')}</h3>
        <p>@${safe(u.username||"user")} • ${safe(u.email||"")} ${friend?'• Friend':''}</p>
        <p class="muted">${u.privateProfile?'Private profile • ':''}${u.friendsOnlyMessages?'Friends-only messages':''}</p>
      </div>
      <div class="actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>
        <button class="btn small green" onclick='sendFriendRequest("${u.uid}")'>Add Friend</button>
        <button class="btn small" ${canMsg?'':'disabled'} onclick='openPrivateChat("${u.uid}")'>Message</button>
        ${blocked?`<button class="btn small" onclick='unblockUser("${u.uid}")'>Unblock</button>`:`<button class="btn small red" onclick='blockUser("${u.uid}")'>Block</button>`}
        <button class="btn small red" onclick='reportProfile("${u.uid}")'>Report</button>
        ${isAppAdmin()?`<button class="btn small" onclick='${u.verified?`unverifyUserAdmin("${u.uid}")`:`verifyUserAdmin("${u.uid}")`}'>${u.verified?'Unverify':'Verify'}</button>`:""}
      </div>
    </div>`;
  }).join("");
  const usersBox=document.getElementById("usersList");
  const searchBox=document.getElementById("globalSearchResults");
  if(usersBox)usersBox.innerHTML=htmlList;
  if(searchBox)searchBox.innerHTML=htmlList;
};

// Override profile viewing to show privacy, friend, block, report, verified


// Guard message open but keep existing chat system working
const _oldOpenPrivateChat = window.openPrivateChat;
function kalbResolveChatUid(value){
  const raw=String(value||"").trim();
  if(!raw || raw==="undefined" || raw==="null") return "";
  const norm=raw.toLowerCase();
  const list=Array.isArray(allUsers)?allUsers:[];
  const exact=list.find(u=>String(u.uid||u.id||"")===raw || String(u.kalbId||"")===raw || String(u.email||"").toLowerCase()===norm || String(u.username||"").toLowerCase()===norm);
  if(exact) return exact.uid||exact.id||"";
  const loose=list.find(u=>String(u.name||"").toLowerCase()===norm || String(u.displayName||"").toLowerCase()===norm || String(u.username||"").toLowerCase().replace(/^@/,'')===norm.replace(/^@/,''));
  return (loose&&(loose.uid||loose.id)) || raw;
}
async function kalbExistingChatWith(uid){
  try{
    if(!currentUser || !uid) return false;
    const ids=[chatIdFor(currentUser.uid,uid), chatIdFor(uid,currentUser.uid), currentUser.uid+"_"+uid, uid+"_"+currentUser.uid];
    for(const id of ids){
      const s=await getDoc(doc(db,"chats",id));
      if(s.exists()) return true;
    }
  }catch(e){}
  return false;
}
window.openPrivateChat=async function(uid){
  const fixedUid=kalbResolveChatUid(uid);
  if(!fixedUid || fixedUid===currentUser?.uid) return alert("User not found.");
  const allowByChat=await kalbExistingChatWith(fixedUid);
  if(!allowByChat && !canMessageSocial(fixedUid)) return alert("You cannot message this user because of block/privacy/friend settings.");
  return _oldOpenPrivateChat(fixedUid);
};
window.__kalbCoreOpenPrivateChat = window.openPrivateChat;
window.startPrivateChat=window.openPrivateChat;
window.startChat=window.openPrivateChat;
window.messageUser=window.openPrivateChat;

// Message seen tick system: add seen status while preserving send button
const _oldListenPrivateMessages = window.listenPrivateMessages || listenPrivateMessages;
window.listenPrivateMessages=function(chatId){
  if(unsubscribeMessages) unsubscribeMessages();
  if(!chatId || !document.getElementById("messagesBox"))return;
  const q=query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc"));
  unsubscribeMessages=onSnapshot(q,function(snapshot){
    const messages=[];
    window._lastMessages={};
    snapshot.forEach(d=>{
      const data={id:d.id,...d.data()};
      window._lastMessages[d.id]=data;
      messages.push(data);
      if((data.senderUid||data.uid)!==currentUser.uid && !data.seen){
        updateDoc(doc(db,"chats",chatId,"messages",d.id),{seen:true,seenAt:serverTimestamp()}).catch(()=>{});
      }
    });
    if(!messages.length){messagesBox.innerHTML='<div class="chat-empty-note">No messages yet. Send first message to start chat.</div>';return;}
    messagesBox.innerHTML=messages.map(m=>{
      const sender=m.senderUid||m.uid;
      const mine=sender===currentUser.uid;
      const name=m.senderName||m.name||m.senderEmail||m.email||"User";
      const tick=mine?`<span class="tick ${m.seen?'seen':''}">${m.seen?'✓✓ Seen':'✓✓ Delivered'}</span>`:"";
      return `<div class="${mine?'msg mine':'msg'}">
        <b>${safe(mine?'You':name)}</b>
        ${m.replyText?`<div class="replybar active">Reply: ${safe(m.replyText)}</div>`:''}
        ${renderKalbMessageBody(m)}
        <span class="muted">${formatDate(m.createdAt)} ${m.edited?' • edited':''} ${tick}</span>
        <div class="actions">
          <button class="btn small" onclick='replyToMessage("${m.id}")'>Reply</button>
          <button class="btn small" onclick='copyMessage("${m.id}")'>Copy</button>
          ${mine?`<button class="btn small" onclick='editMessage("${m.id}")'>Edit</button>`:''}
        </div>
      </div>`;
    }).join("");
    messagesBox.scrollTop=messagesBox.scrollHeight;
  },function(err){console.error(err);});
};

// Use +/Search page for requests
const _oldOpenPageSocial=window.openPage;
window.openPage=function(id,navEl){
  if(id==='chatListPage') id='chatsPage';
  _oldOpenPageSocial(id,navEl);
  if(id==="searchPage"){renderFriendRequests();renderUsers();}
  if(id==="usersPage"){renderUsers();}
  if(id==="themePage"){applySocialTheme();}
};

// Comment fix: force show box and load comments from posts/{postId}/comments
function findAnyCommentBox(postId,boxKey){
  const key=boxKey?String(boxKey).replace(/[^a-zA-Z0-9_-]/g,"_"):"";
  return (key&&document.getElementById("comments_"+key+"_"+postId)) ||
    document.getElementById("comments_"+postId) ||
    document.querySelector('[data-comments-post="'+postId+'"]') ||
    document.querySelector('[id^="comments_"][id$="_'+postId+'"]');
}
window.toggleComments=function(postId,boxKey){
  const box=findAnyCommentBox(postId,boxKey);
  if(!box)return alert("Comment box not found. Refresh once.");
  const opening=box.classList.contains("hidden") || box.style.display==="none" || getComputedStyle(box).display==="none";
  box.classList.toggle("hidden",!opening);
  box.style.display=opening?"block":"none";
  if(opening)listenPostComments(postId,boxKey);
};
window.listenPostComments=function(postId,boxKey){
  const box=findAnyCommentBox(postId,boxKey);
  if(!box)return;
  let list=box.querySelector("[data-comment-list]")||box.querySelector(".comment-list")||box.querySelector("div");
  if(!list){list=document.createElement("div");box.prepend(list);}
  list.innerHTML='<p class="muted">Loading comments...</p>';
  const q=query(collection(db,"posts",postId,"comments"),orderBy("createdAt","asc"));
  onSnapshot(q,function(snap){
    const arr=[];snap.forEach(d=>arr.push({id:d.id,...d.data()}));
    list.innerHTML=arr.length?arr.map(c=>`<div class="comment-item"><b>${safe(c.name||c.username||c.email||"User")}</b><p>${safe(c.text||"")}</p><p class="muted">${formatDate(c.createdAt)}</p></div>`).join(""):'<p class="muted">No comments yet.</p>';
    document.querySelectorAll('[data-comment-count="'+postId+'"]').forEach(el=>el.innerText=arr.length);
  },function(e){console.error(e);list.innerHTML='<p class="muted">Comments need updated Firestore rules.</p>';});
};
window.addComment=async function(postId,boxKey){
  if(!currentUser)return alert("Login first.");
  const box=findAnyCommentBox(postId,boxKey);
  const input=box?.querySelector("[data-comment-input]")||box?.querySelector("input");
  if(!input)return alert("Comment input not found.");
  const text=(input.value||"").trim(); if(!text)return;
  await addDoc(collection(db,"posts",postId,"comments"),{text,uid:currentUser.uid,email:currentUser.email||"",name:currentUserProfile?.name||currentUser.displayName||"User",username:currentUserProfile?.username||"user",createdAt:serverTimestamp()});
  input.value="";
  listenPostComments(postId,boxKey);
};

try{listenPrivateMessages=window.listenPrivateMessages}catch(e){}
window.addEventListener("DOMContentLoaded",()=>{try{applySocialTheme()}catch(e){}});



/* === FINAL FRIENDS + UNFRIEND FIX (module scoped, Firestore working) === */
window.__kalbFriendsFixVersion = "2026-05-16-final-friends";

async function reloadCurrentUserProfileFinal(){
  if(!currentUser) return null;
  try{
    const s = await getDoc(doc(db,"users",currentUser.uid));
    if(s.exists()) currentUserProfile = {uid:s.id,...s.data()};
  }catch(e){ console.warn("profile reload failed", e); }
  return currentUserProfile;
}

async function reloadAllUsersFinal(){
  try{
    const s = await getDocs(collection(db,"users"));
    allUsers = [];
    s.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
  }catch(e){ console.warn("users reload failed", e); }
  return allUsers || [];
}

async function getAcceptedFriendIdsFinal(){
  if(!currentUser) return [];
  const me = currentUser.uid;
  const ids = new Set();
  await reloadCurrentUserProfileFinal();
  await reloadAllUsersFinal();

  // Friends saved in my own profile
  const myFriends = currentUserProfile && Array.isArray(currentUserProfile.friends) ? currentUserProfile.friends : [];
  myFriends.forEach(id=>id && id!==me && ids.add(id));

  // Reverse friends saved in other profiles
  (allUsers||[]).forEach(u=>{
    if(u.uid!==me && Array.isArray(u.friends) && u.friends.includes(me)) ids.add(u.uid);
  });

  // Accepted friend request documents. This works even when profile arrays were not updated.
  try{
    const s = await getDocs(collection(db,"friendRequests"));
    s.forEach(d=>{
      const r=d.data()||{};
      if(r.status !== "accepted") return;
      const from = r.from || r.fromUid || r.senderId;
      const to = r.to || r.toUid || r.receiverId;
      if(from===me && to && to!==me) ids.add(to);
      if(to===me && from && from!==me) ids.add(from);
    });
  }catch(e){ console.warn("accepted request lookup failed", e); }

  return [...ids];
}

window.socialIsFriend = function(uid){
  if(!uid || !currentUserProfile) return false;
  return Array.isArray(currentUserProfile.friends) && currentUserProfile.friends.includes(uid);
};

window.renderFriendsList = async function(){
  const boxes = [document.getElementById("friendsOnlyBox"), document.getElementById("friendsListBox")].filter(Boolean);
  if(!boxes.length) return;
  if(!currentUser){ boxes.forEach(b=>b.innerHTML='<div class="card empty">Login first.</div>'); return; }
  boxes.forEach(b=>b.innerHTML='<div class="card empty">Loading accepted friends...</div>');

  const ids = await getAcceptedFriendIdsFinal();
  if(!ids.length){
    boxes.forEach(b=>b.innerHTML='<div class="card empty">No accepted friends yet. Go to Search, send a friend request, and after they accept, they will appear here.</div>');
    return;
  }

  const usersById = new Map((allUsers||[]).map(u=>[u.uid,u]));
  const friends = ids.map(id=>usersById.get(id)).filter(Boolean);
  if(!friends.length){
    boxes.forEach(b=>b.innerHTML='<div class="card empty">Friend found, but user profile is missing. Tap Refresh Friends again.</div>');
    return;
  }

  const html = friends.map(u=>{
    const displayName = safe(u.name || u.displayName || u.email || "User");
    const username = safe(u.username || ((u.email||"user").split("@")[0]) || "user");
    const avatar = safe(u.avatarEmoji || initials(u.name,u.email));
    const verified = u.verified ? '<span class="badge-verified">✓</span>' : '';
    const blocked = (currentUserProfile?.blockedUsers||[]).includes(u.uid);
    return `<div class="card user-row friend-row-fixed">
      <div class="avatar" style="background:${avatarStyle(u.avatarColor)}">${avatar}</div>
      <div class="user-info">
        <h3 class="search-user-name">${displayName} ${verified}</h3>
        <p class="search-user-username">@${username} • Friend</p>
        <p class="muted">${safe(u.bio||"")}</p>
      </div>
      <div class="actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>
        <button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>
        <button class="btn small red" onclick='unfriendUser("${u.uid}")'>Unfriend</button>
        ${blocked?`<button class="btn small" onclick='unblockUser("${u.uid}")'>Unblock</button>`:`<button class="btn small red" onclick='blockUser("${u.uid}")'>Block</button>`}
      </div>
    </div>`;
  }).join("");
  boxes.forEach(b=>b.innerHTML=html);
};

window.unfriendUser = async function(uid){
  if(!currentUser || !uid) return alert("Login first.");
  if(!confirm("Remove this friend?")) return;
  const me = currentUser.uid;

  try{ await updateDoc(doc(db,"users",me),{friends:arrayRemove(uid)}); }catch(e){ console.warn("remove from my friends failed", e); }
  try{ await updateDoc(doc(db,"users",uid),{friends:arrayRemove(me)}); }catch(e){ console.warn("remove from other friends failed", e); }

  try{
    const s = await getDocs(collection(db,"friendRequests"));
    const jobs=[];
    s.forEach(d=>{
      const r=d.data()||{};
      const from = r.from || r.fromUid || r.senderId;
      const to = r.to || r.toUid || r.receiverId;
      if(r.status==="accepted" && ((from===me && to===uid) || (from===uid && to===me))){
        jobs.push(updateDoc(doc(db,"friendRequests",d.id),{status:"unfriended",unfriendedAt:serverTimestamp()}));
      }
    });
    await Promise.all(jobs);
  }catch(e){ console.warn("friend request unfriend update failed", e); }

  await reloadCurrentUserProfileFinal();
  await reloadAllUsersFinal();
  await renderFriendsList();
  if(typeof renderUsers === "function") renderUsers();
  alert("Friend removed.");
};

window.acceptFriendRequest = async function(reqId, fromUid){
  if(!currentUser) return alert("Login first.");
  if(!reqId || !fromUid) return alert("Request not found.");
  try{
    await updateDoc(doc(db,"friendRequests",reqId),{status:"accepted",acceptedAt:serverTimestamp()});
    await updateDoc(doc(db,"users",currentUser.uid),{friends:arrayUnion(fromUid)});
    await updateDoc(doc(db,"users",fromUid),{friends:arrayUnion(currentUser.uid)});
    await reloadCurrentUserProfileFinal();
    await reloadAllUsersFinal();
    if(typeof renderFriendRequests === "function") renderFriendRequests();
    renderFriendsList();
    renderUsers();
    alert("Friend request accepted.");
  }catch(e){
    console.error(e);
    alert("Accept failed: check Firestore rules for users and friendRequests.");
  }
};

window.renderUsers = function(){
  const q = ((document.getElementById("globalSearchInput")?.value || document.getElementById("userSearch")?.value || "")).toLowerCase();
  let list = (allUsers||[]).filter(u=>u.uid !== currentUser?.uid);
  list = list.filter(u=>(((u.name||"")+" "+(u.displayName||"")+" "+(u.username||"")+" "+(u.email||"")).toLowerCase()).includes(q));
  const html = !list.length ? '<div class="card empty">No users found.</div>' : list.map(u=>{
    const isFriend = Array.isArray(currentUserProfile?.friends) && currentUserProfile.friends.includes(u.uid);
    const blocked = (currentUserProfile?.blockedUsers||[]).includes(u.uid);
    const displayName = safe(u.name || u.displayName || u.email || "User");
    const username = safe(u.username || ((u.email||"user").split("@")[0]) || "user");
    return `<div class="card user-row">
      <div class="avatar" style="background:${avatarStyle(u.avatarColor)}">${safe(u.avatarEmoji||initials(u.name,u.email))}</div>
      <div class="user-info">
        <h3 class="search-user-name">${displayName} ${u.verified?'<span class="badge-verified">✓</span>':''}</h3>
        <p class="search-user-username">@${username} • ${safe(u.email||"")} ${isFriend?'• Friend':''}</p>
        <p class="muted">${safe(u.bio||"")}</p>
      </div>
      <div class="actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>
        ${isFriend?`<button class="btn small red" onclick='unfriendUser("${u.uid}")'>Unfriend</button>`:`<button class="btn small green" onclick='sendFriendRequest("${u.uid}")'>Add Friend</button>`}
        <button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>
        ${blocked?`<button class="btn small" onclick='unblockUser("${u.uid}")'>Unblock</button>`:`<button class="btn small red" onclick='blockUser("${u.uid}")'>Block</button>`}
        <button class="btn small red" onclick='reportProfile("${u.uid}")'>Report</button>
        ${isAppAdmin()?`<button class="btn small" onclick='${u.verified?`unverifyUserAdmin("${u.uid}")`:`verifyUserAdmin("${u.uid}")`}'>${u.verified?'Unverify':'Verify'}</button>`:""}
      </div>
    </div>`;
  }).join("");
  const usersBox = document.getElementById("usersList");
  const searchBox = document.getElementById("globalSearchResults");
  if(usersBox) usersBox.innerHTML = html;
  if(searchBox) searchBox.innerHTML = html;
};

const __oldOpenPageFriendsFinal = window.openPage;
window.openPage = function(id, navEl){
  __oldOpenPageFriendsFinal(id, navEl);
  setTimeout(()=>{
    if(id==="friendsPage" || id==="usersPage") window.renderFriendsList();
    if(id==="searchPage" || id==="usersPage") { if(typeof renderFriendRequests==="function") renderFriendRequests(); window.renderUsers(); }
  }, 80);
};

// Keep friends page fresh when user data changes.
try{
  const __oldListenUsersRenderFriends = window.refreshSearchPage;
  window.refreshSearchPage = function(){
    if(typeof __oldListenUsersRenderFriends === "function") __oldListenUsersRenderFriends();
    window.renderFriendsList();
  };
}catch(e){}



/* FINAL PROFILE FIX INSIDE MODULE - NO AUTH/CURRENTUSER UNDEFINED */
window.getLoggedUserFinal = function(){
  return currentUser || auth.currentUser || window.currentUser || window.__lastAuthUser || null;
};

window.reloadUsersForProfileFinal = async function(){
  try{
    const snap = await getDocs(collection(db,"users"));
    allUsers = [];
    snap.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
    window.allUsers = allUsers;
  }catch(e){
    console.warn("Profile users reload failed", e);
  }
  return allUsers || [];
};

window.getProfileUserFinal = async function(uid){
  await window.reloadUsersForProfileFinal();
  let u = (allUsers || []).find(x=>x.uid===uid);
  if(!u){
    try{
      const s = await getDoc(doc(db,"users",uid));
      if(s.exists()) u = {uid:s.id,...s.data()};
    }catch(e){ console.warn("Profile user load failed", e); }
  }
  return u || null;
};

window.canViewProfileFinalSafe = function(u){
  const me = window.getLoggedUserFinal();
  if(!me || !u) return false;
  if(u.uid === me.uid) return true;
  if(typeof isAppAdmin === "function" && isAppAdmin()) return true;
  if(!u.privateProfile) return true;
  const friends = Array.isArray(u.friends) ? u.friends : [];
  const followers = Array.isArray(u.followers) ? u.followers : [];
  return friends.includes(me.uid) || followers.includes(me.uid);
};

window.profilePeopleHtmlFinal = function(ids,title){
  const list = (allUsers || []).filter(u=>ids.includes(u.uid));
  if(!list.length) return `<div class="profile-final-post"><p class="muted">No ${safe(title).toLowerCase()} yet.</p></div>`;
  return `<h3>${safe(title)}</h3>` + list.map(u=>{
    const name = safe(u.name || u.displayName || u.email || "User");
    const username = safe(u.username || ((u.email || "user").split("@")[0]));
    return `<div class="profile-final-list">
      <div class="avatar" style="width:48px;height:48px;background:${avatarStyle(u.avatarColor)}">${safe(u.avatarEmoji || initials(u.name,u.email))}</div>
      <div><h3>${name} ${verifiedHtml(u)}</h3><p>@${username}</p></div>
      <div class="actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>View</button>
        <button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>
      </div>
    </div>`;
  }).join("");
};

window.profilePostsHtmlFinal = function(uid){
  const posts = (allPosts || []).filter(p=>(p.uid || p.userId || p.authorUid) === uid);
  if(!posts.length) return `<div class="profile-final-post"><p class="muted">No posts yet.</p></div>`;
  return `<h3>Posts</h3>` + posts.map(p=>`
    <div class="profile-final-post">
      <p>${safe(p.text || p.content || p.caption || "")}</p>
      <p class="muted">${formatDate(p.createdAt)}</p>
    </div>
  `).join("");
};

window.showProfileFinalTab = function(type){
  const followers = document.getElementById("profileFollowersListFinal");
  const following = document.getElementById("profileFollowingListFinal");
  const posts = document.getElementById("profilePostsListFinal");
  if(followers) followers.style.display = type === "followers" ? "block" : "none";
  if(following) following.style.display = type === "following" ? "block" : "none";
  if(posts) posts.style.display = type === "posts" ? "block" : "none";
};

window.openMyFinalProfile = async function(){
  const me = window.getLoggedUserFinal();
  if(!me) return alert("Please login first.");
  return window.viewUserProfile(me.uid);
};

window.togglePrivateProfileFinal = async function(){
  const me = window.getLoggedUserFinal();
  if(!me) return alert("Please login first.");
  const next = !(currentUserProfile && currentUserProfile.privateProfile === true);
  try{
    await setDoc(doc(db,"users",me.uid),{privateProfile:next,updatedAt:serverTimestamp()},{merge:true});
    currentUserProfile = {...(currentUserProfile || {}), privateProfile: next};
    window.currentUserProfile = currentUserProfile;
    const st = document.getElementById("profilePrivacyStatus");
    if(st) st.innerText = next ? "Your profile is Private" : "Your profile is Public";
    alert(next ? "Profile set to Private" : "Profile set to Public");
  }catch(e){
    console.error(e);
    alert("Privacy update failed: " + (e.message || e));
  }
};

window.followUserFinal = async function(uid){
  const me = window.getLoggedUserFinal();
  if(!me || !uid || uid === me.uid) return;
  try{
    await setDoc(doc(db,"users",me.uid),{following:arrayUnion(uid),updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,"users",uid),{followers:arrayUnion(me.uid),updatedAt:serverTimestamp()},{merge:true});
    await loadProfile();
    await window.viewUserProfile(uid);
  }catch(e){
    console.error(e);
    alert("Follow failed: " + (e.message || e));
  }
};

window.unfollowUserFinal = async function(uid){
  const me = window.getLoggedUserFinal();
  if(!me || !uid || uid === me.uid) return;
  try{
    await setDoc(doc(db,"users",me.uid),{following:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,"users",uid),{followers:arrayRemove(me.uid),updatedAt:serverTimestamp()},{merge:true});
    await loadProfile();
    await window.viewUserProfile(uid);
  }catch(e){
    console.error(e);
    alert("Unfollow failed: " + (e.message || e));
  }
};

window.toggleFollowViewedProfile = async function(){
  const uid = window.viewingProfileUid || (viewedProfileUser && viewedProfileUser.uid);
  if(!uid) return alert("No profile selected.");
  const me = window.getLoggedUserFinal();
  if(!me) return alert("Please login first.");
  const u = await window.getProfileUserFinal(uid);
  const followers = Array.isArray(u?.followers) ? u.followers : [];
  if(followers.includes(me.uid)) return window.unfollowUserFinal(uid);
  return window.followUserFinal(uid);
};

window.viewUserProfile = async function(uid){
  try{
    const me = window.getLoggedUserFinal();
    if(!me) return alert("Please login first.");
    if(!uid) return alert("User profile not found.");

    const u = await window.getProfileUserFinal(uid);
    if(!u) return alert("User profile not found.");

    viewedProfileUser = u;
    window.viewingProfileUid = uid;

    const isMe = uid === me.uid;
    const followers = Array.isArray(u.followers) ? u.followers : [];
    const following = Array.isArray(u.following) ? u.following : [];
    const friends = Array.isArray(u.friends) ? u.friends : [];
    const canView = window.canViewProfileFinalSafe(u);
    const posts = (allPosts || []).filter(p=>(p.uid || p.userId || p.authorUid) === uid);
    const followingNow = followers.includes(me.uid) || ((currentUserProfile?.following || []).includes(uid));

    const avatar = document.getElementById("viewProfileAvatar");
    if(avatar){
      avatar.innerText = u.avatarEmoji || initials(u.name,u.email);
      avatar.style.background = avatarStyle(u.avatarColor);
    }
    const nameEl = document.getElementById("viewProfileName");
    if(nameEl) nameEl.innerHTML = `${safe(u.name || u.displayName || u.email || "User")} ${verifiedHtml(u)}`;
    const usernameEl = document.getElementById("viewProfileUsername");
    if(usernameEl) usernameEl.innerText = "@" + (u.username || ((u.email || "user").split("@")[0]));
    const emailEl = document.getElementById("viewProfileEmail");
    if(emailEl) emailEl.innerText = u.email || "";
    const bioEl = document.getElementById("viewProfileBio");
    if(bioEl) bioEl.innerText = u.bio || "No bio added.";
    const lastSeenEl = document.getElementById("viewProfileLastSeen");
    if(lastSeenEl) lastSeenEl.innerText = u.hideOnline ? "Online hidden" : (typeof formatLastSeen === "function" ? formatLastSeen(u) : "");

    const f1 = document.getElementById("viewFollowersCount");
    if(f1) f1.innerText = followers.length;
    const f2 = document.getElementById("viewFollowingCount");
    if(f2) f2.innerText = following.length;
    const f3 = document.getElementById("viewPostsCount");
    if(f3) f3.innerText = canView ? posts.length : 0;
    const f4 = document.getElementById("viewFriendsCountFinal");
    if(f4) f4.innerText = friends.length;
    const f5 = document.getElementById("viewPrivacyFinal");
    if(f5) f5.innerText = u.privateProfile ? "Private" : "Public";
    const f6 = document.getElementById("viewJoinedFinal");
    if(f6) f6.innerText = u.createdAt ? formatDate(u.createdAt).split(",")[0] : "—";

    const note = document.getElementById("viewProfilePrivacyNote");
    if(note) note.innerHTML = !canView ? `<div class="profile-polish-lock"><b>🔒 Private Profile</b>This profile is private. Follow or become friends to view posts and lists.</div>` : "";
    if(typeof renderProfilePolishExtras==="function") renderProfilePolishExtras(u,canView,posts);

    const followersBox = document.getElementById("profileFollowersListFinal");
    if(followersBox) followersBox.innerHTML = canView ? window.profilePeopleHtmlFinal(followers,"Followers") : "";
    const followingBox = document.getElementById("profileFollowingListFinal");
    if(followingBox) followingBox.innerHTML = canView ? window.profilePeopleHtmlFinal(following,"Following") : "";
    const postsBox = document.getElementById("profilePostsListFinal");
    if(postsBox) postsBox.innerHTML = canView ? window.profilePostsHtmlFinal(uid) : "";

    const row = document.querySelector("#viewProfilePage .profile-action-row");
    if(row){
      row.innerHTML = `
        ${isMe ? `<button class="btn small" onclick="togglePrivateProfileFinal()">Toggle Privacy</button>` : ""}
        ${!isMe ? (followingNow ? `<button class="btn small red" onclick='unfollowUserFinal("${uid}")'>Unfollow</button>` : `<button class="btn small green" onclick='followUserFinal("${uid}")'>Follow</button>`) : ""}
        ${!isMe ? `<button class="btn small green" onclick='sendFriendRequest("${uid}")'>Add Friend</button>` : ""}
        ${!isMe ? `<button class="btn small" onclick='openPrivateChat("${uid}")'>Message</button>` : ""}
        ${!isMe ? `<button class="btn small red" onclick='reportProfile("${uid}")'>Report</button>` : ""}
        ${typeof isAppAdmin === "function" && isAppAdmin() && !isMe ? `<button class="btn small" onclick='${u.verified ? `unverifyUserAdmin("${uid}")` : `verifyUserAdmin("${uid}")`}'>${u.verified ? "Unverify" : "Verify"}</button>` : ""}
      `;
    }

    if(typeof enhanceProfileViewUpgrade==="function")enhanceProfileViewUpgrade(u,canView,posts);
    window.showProfileFinalTab("followers");
    openPage("viewProfilePage");
  }catch(e){
    console.error("Profile opening failed", e);
    alert("Profile opening failed: " + (e.message || e));
  }
};



/* PROFILE POLISH FINAL UPDATE - SAFE OVERRIDES */
window.profilePeopleHtmlFinal = function(ids,title){
  const list = (allUsers || []).filter(u=>ids.includes(u.uid));
  if(!list.length){
    return `<div class="profile-polish-post"><p class="muted">No ${safe(title).toLowerCase()} yet.</p></div>`;
  }
  return `<h3 style="margin-top:12px">${safe(title)}</h3>` + list.map(u=>{
    const name = safe(u.name || u.displayName || u.email || "User");
    const username = safe(u.username || ((u.email || "user").split("@")[0]));
    return `<div class="profile-polish-list">
      <div class="avatar" style="background:${avatarStyle(u.avatarColor)}">${safe(u.avatarEmoji || initials(u.name,u.email))}</div>
      <div>
        <h3>${name} ${verifiedHtml(u)}</h3>
        <p>@${username}</p>
        <p>${safe(u.bio || "No bio added.")}</p>
      </div>
      <div class="actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>View</button>
        <button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>
      </div>
    </div>`;
  }).join("");
};

window.profilePostsHtmlFinal = function(uid){
  const posts = (allPosts || []).filter(p=>(p.uid || p.userId || p.authorUid) === uid);
  if(!posts.length){
    return `<div class="profile-polish-post"><p class="muted">No posts yet. Posts made by this user will appear here.</p></div>`;
  }
  return `<h3 style="margin-top:12px">User Posts</h3>` + posts.map(p=>`
    <div class="profile-polish-post">
      <p>${safe(p.text || p.content || p.caption || "")}</p>
      <p class="muted">${formatDate(p.createdAt)}</p>
    </div>
  `).join("");
};

window.renderProfilePolishExtras = function(u,canView,posts){
  const old=document.getElementById("profilePolishExtraStats");
  if(old)old.remove();
  const bio=document.getElementById("viewProfileBio");
  if(!bio)return;
  const followers=Array.isArray(u.followers)?u.followers:[];
  const following=Array.isArray(u.following)?u.following:[];
  const friends=Array.isArray(u.friends)?u.friends:[];
  const wrap=document.createElement("div");
  wrap.id="profilePolishExtraStats";
  wrap.className="profile-polish-stats-extra";
  wrap.innerHTML=`
    <div class="profile-polish-stat"><b>${followers.length}</b><span>Followers</span></div>
    <div class="profile-polish-stat"><b>${following.length}</b><span>Following</span></div>
    <div class="profile-polish-stat"><b>${friends.length}</b><span>Friends</span></div>
    <div class="profile-polish-stat"><b>${canView?posts.length:0}</b><span>Posts</span></div>
  `;
  bio.insertAdjacentElement("afterend",wrap);
};

window.showProfileFinalTab = function(type){
  const followers = document.getElementById("profileFollowersListFinal");
  const following = document.getElementById("profileFollowingListFinal");
  const posts = document.getElementById("profilePostsListFinal");
  if(followers) followers.style.display = type === "followers" ? "block" : "none";
  if(following) following.style.display = type === "following" ? "block" : "none";
  if(posts) posts.style.display = type === "posts" ? "block" : "none";
  document.querySelectorAll(".profile-polish-tabs button,.profile-final-tabs button").forEach(b=>b.classList.remove("active"));
};



/* PROFILE UPGRADES 22-26 MODULE */
window.profileBannerMap={
  "cyan-purple":"linear-gradient(135deg,#06b6d4,#8b5cf6)",
  "green-teal":"linear-gradient(135deg,#22c55e,#14b8a6)",
  "orange-red":"linear-gradient(135deg,#f97316,#ef4444)",
  "pink-violet":"linear-gradient(135deg,#ec4899,#8b5cf6)",
  "gold-fire":"linear-gradient(135deg,#facc15,#f97316)",
  "dark-steel":"linear-gradient(135deg,#0f172a,#334155)"
};

window.setProfileBannerColor=function(color){
  currentUserProfile={...(currentUserProfile||{}),bannerColor:color};
  document.querySelectorAll(".banner-dot").forEach(d=>d.style.outline="none");
  event?.currentTarget && (event.currentTarget.style.outline="3px solid rgba(255,255,255,.65)");
};

window.toggleProfileBadge=function(badge){
  const list=Array.isArray(currentUserProfile?.badges)?[...currentUserProfile.badges]:[];
  const i=list.indexOf(badge);
  if(i>=0)list.splice(i,1);else list.push(badge);
  currentUserProfile={...(currentUserProfile||{}),badges:list};
  document.querySelectorAll(".badge-chip").forEach(btn=>{
    btn.classList.toggle("active",list.includes(btn.textContent.trim()));
  });
};

window.saveProfileAboutUpgrade=async function(){
  const me=window.getLoggedUserFinal?window.getLoggedUserFinal():(currentUser||auth.currentUser);
  if(!me)return alert("Please login first.");
  const data={
    bannerColor:currentUserProfile?.bannerColor||"cyan-purple",
    badges:Array.isArray(currentUserProfile?.badges)?currentUserProfile.badges:[],
    school:document.getElementById("profileSchoolInput")?.value.trim()||"",
    city:document.getElementById("profileCityInput")?.value.trim()||"",
    profileLink:document.getElementById("profileLinkInput")?.value.trim()||"",
    updatedAt:serverTimestamp()
  };
  try{
    await setDoc(doc(db,"users",me.uid),data,{merge:true});
    currentUserProfile={...(currentUserProfile||{}),...data};
    const st=document.getElementById("profileUpgradeStatus");
    if(st)st.innerText="Profile upgrade saved.";
    alert("Profile upgrade saved.");
  }catch(e){
    console.error(e);
    alert("Save failed: "+(e.message||e));
  }
};

window.loadProfileUpgradeInputs=function(){
  const u=currentUserProfile||{};
  const school=document.getElementById("profileSchoolInput");
  const city=document.getElementById("profileCityInput");
  const link=document.getElementById("profileLinkInput");
  if(school)school.value=u.school||"";
  if(city)city.value=u.city||"";
  if(link)link.value=u.profileLink||"";
  document.querySelectorAll(".badge-chip").forEach(btn=>{
    btn.classList.toggle("active",(u.badges||[]).includes(btn.textContent.trim()));
  });
};

window.profileBadgesHtml=function(u){
  const badges=Array.isArray(u.badges)?u.badges:[];
  if(!badges.length)return "";
  return `<div class="profile-badges-line">${badges.map(b=>`<span class="profile-badge-view">${safe(b)}</span>`).join("")}</div>`;
};

window.profileAboutHtml=function(u){
  const link=(u.profileLink||"").trim();
  return `<div class="profile-about-grid">
    <div class="profile-about-item"><small>School / College</small><b>${safe(u.school||"Not added")}</b></div>
    <div class="profile-about-item"><small>City</small><b>${safe(u.city||"Not added")}</b></div>
    <div class="profile-about-item"><small>Email</small><b>${safe(u.email||"Hidden")}</b></div>
    <div class="profile-about-item"><small>Profile Link</small><b>${link?`<a class="profile-link-btn" href="${safe(link)}" target="_blank">Open Link</a>`:"Not added"}</b></div>
  </div>`;
};

window.profileActivityHtml=function(uid){
  const posts=(allPosts||[]).filter(p=>(p.uid||p.userId||p.authorUid)===uid).slice(0,8);
  const html=[];
  posts.forEach(p=>{
    html.push(`<div class="profile-activity-card"><div class="activity-dot">📝</div><div><b>Posted in feed</b><p class="muted">${safe((p.text||p.content||p.caption||"").slice(0,80))}</p><p class="muted">${formatDate(p.createdAt)}</p></div></div>`);
  });
  if(!html.length)html.push(`<div class="profile-activity-card"><div class="activity-dot">✨</div><div><b>No activity yet</b><p class="muted">Profile activity will appear here.</p></div></div>`);
  return `<h3 style="margin-top:12px">Activity Timeline</h3>${html.join("")}`;
};

window.filterProfilePeople=function(section,q){
  q=(q||"").toLowerCase();
  document.querySelectorAll(`#${section} .profile-polish-list,#${section} .profile-final-list`).forEach(card=>{
    card.style.display=card.innerText.toLowerCase().includes(q)?"grid":"none";
  });
};

window.enhanceProfileViewUpgrade=function(u,canView,posts){
  const name=document.getElementById("viewProfileName");
  if(name && !document.getElementById("profileBannerFinal")){
    const banner=document.createElement("div");
    banner.id="profileBannerFinal";
    banner.className="profile-banner-final";
    banner.style.background=profileBannerMap[u.bannerColor]||profileBannerMap["cyan-purple"];
    const card=document.querySelector("#viewProfilePage .card");
    if(card)card.insertBefore(banner,card.firstChild);
  }else{
    const banner=document.getElementById("profileBannerFinal");
    if(banner)banner.style.background=profileBannerMap[u.bannerColor]||profileBannerMap["cyan-purple"];
  }

  const username=document.getElementById("viewProfileUsername");
  if(username){
    let old=document.getElementById("profileBadgesLineFinal");
    if(old)old.remove();
    const wrap=document.createElement("div");
    wrap.id="profileBadgesLineFinal";
    wrap.innerHTML=profileBadgesHtml(u);
    username.insertAdjacentElement("afterend",wrap);
  }

  const bio=document.getElementById("viewProfileBio");
  if(bio){
    let old=document.getElementById("profileAboutFinal");
    if(old)old.remove();
    const about=document.createElement("div");
    about.id="profileAboutFinal";
    about.innerHTML=profileAboutHtml(u);
    bio.insertAdjacentElement("afterend",about);
  }

  const followers=document.getElementById("profileFollowersListFinal");
  if(followers && !document.getElementById("followersSearchFinal")){
    followers.insertAdjacentHTML("afterbegin",`<input id="followersSearchFinal" class="profile-search-input" placeholder="Search followers..." oninput="filterProfilePeople('profileFollowersListFinal',this.value)">`);
  }
  const following=document.getElementById("profileFollowingListFinal");
  if(following && !document.getElementById("followingSearchFinal")){
    following.insertAdjacentHTML("afterbegin",`<input id="followingSearchFinal" class="profile-search-input" placeholder="Search following..." oninput="filterProfilePeople('profileFollowingListFinal',this.value)">`);
  }
  const postsBox=document.getElementById("profilePostsListFinal");
  if(postsBox && canView && !document.getElementById("profileActivityTimelineFinal")){
    postsBox.insertAdjacentHTML("beforeend",`<div id="profileActivityTimelineFinal">${profileActivityHtml(u.uid)}</div>`);
  }
};



/* NOTIFICATION BADGE COUNT UPDATE MODULE */
(function(){
  window.kalbBadgeCounts = { chats:0, requests:0, activity:0, calls:0 };
  window.kalbBadgeUnsubs = window.kalbBadgeUnsubs || [];

  function badgeUser(){
    try{
      return currentUser || (typeof auth !== "undefined" ? auth.currentUser : null);
    }catch(e){ return null; }
  }

  function capCount(n){
    n = Number(n || 0);
    return n > 99 ? "99+" : String(n);
  }

  function makeBadge(id){
    let b = document.getElementById(id);
    if(!b){
      b = document.createElement("span");
      b.id = id;
      b.className = "notify-badge";
      b.textContent = "0";
      document.body.appendChild(b);
    }
    return b;
  }

  function attachBadgeToButton(selectorList, badgeId){
    const badge = makeBadge(badgeId);
    for(const selector of selectorList){
      const el = document.querySelector(selector);
      if(el){
        if(!el.classList.contains("badge-wrap")) el.classList.add("badge-wrap");
        if(badge.parentElement !== el) el.appendChild(badge);
        return badge;
      }
    }
    return badge;
  }

  function findButtonByText(words){
    const buttons = Array.from(document.querySelectorAll("button,a,.nav-item,.tab-btn,.bottom-tab,.icon-btn,.top-action-btn"));
    return buttons.find(el=>{
      const t=(el.textContent||"").toLowerCase();
      return words.some(w=>t.includes(w));
    });
  }

  function attachTextBadge(words,badgeId){
    const badge = makeBadge(badgeId);
    const el = findButtonByText(words);
    if(el){
      if(!el.classList.contains("badge-wrap")) el.classList.add("badge-wrap");
      if(badge.parentElement !== el) el.appendChild(badge);
    }
    return badge;
  }

  window.ensureBadgesFinal=function(){
    attachBadgeToButton([
      '[onclick*="chatsPage"]',
      '[onclick*="chatPage"]',
      '[onclick*="openChats"]',
      '[data-page="chatsPage"]',
      '[data-page="chatPage"]',
      '#chatsTab',
      '#chatTab'
    ], "badgeChatsFinal");
    attachTextBadge(["chat"], "badgeChatsFinal");

    attachBadgeToButton([
      '[onclick*="requests"]',
      '[onclick*="Requests"]',
      '[onclick*="friendRequest"]',
      '#requestsBtn',
      '#friendRequestsBtn'
    ], "badgeRequestsFinal");
    attachTextBadge(["request"], "badgeRequestsFinal");

    attachBadgeToButton([
      '[onclick*="activityPage"]',
      '[onclick*="Activity"]',
      '[data-page="activityPage"]',
      '#activityTopBtn',
      '#activityBtn'
    ], "badgeActivityFinal");
    attachTextBadge(["activity"], "badgeActivityFinal");

    attachBadgeToButton([
      '[onclick*="callsPage"]',
      '[onclick*="callPage"]',
      '[data-page="callsPage"]',
      '#callsTab',
      '#callTab'
    ], "badgeCallsFinal");
    attachTextBadge(["call"], "badgeCallsFinal");
  };

  window.updateBadgeFinal=function(name,count){
    kalbBadgeCounts[name]=count || 0;
    const map = {
      chats:"badgeChatsFinal",
      requests:"badgeRequestsFinal",
      activity:"badgeActivityFinal",
      calls:"badgeCallsFinal"
    };
    const b=document.getElementById(map[name]);
    if(!b)return;
    if(count>0){
      b.textContent=capCount(count);
      b.classList.add("show");
    }else{
      b.textContent="0";
      b.classList.remove("show");
    }
  };

  function clearBadgeOnOpen(pageId){
    const id = String(pageId||"").toLowerCase();
    if(id.includes("chat")) updateBadgeFinal("chats",0);
    if(id.includes("request") || id.includes("search")) updateBadgeFinal("requests",0);
    if(id.includes("activity")) updateBadgeFinal("activity",0);
    if(id.includes("call")) updateBadgeFinal("calls",0);
  }

  if(typeof openPage==="function" && !window.__badgeOpenPageWrapped){
    window.__badgeOpenPageWrapped=true;
    const oldOpenPageBadge=openPage;
    window.openPage=function(id,navEl){
      const result=oldOpenPageBadge(id,navEl);
      clearBadgeOnOpen(id);
      setTimeout(ensureBadgesFinal,100);
      return result;
    };
  }

  function stopBadges(){
    try{
      (window.kalbBadgeUnsubs||[]).forEach(fn=>{try{fn()}catch(e){}});
      window.kalbBadgeUnsubs=[];
    }catch(e){}
  }

  function listenIncomingRequests(me){
    try{
      const q1=query(collection(db,"friendRequests"), where("to","==",me.uid), where("status","==","pending"));
      const unsub=onSnapshot(q1, snap=>updateBadgeFinal("requests", snap.size), err=>console.warn("request badge failed",err));
      kalbBadgeUnsubs.push(unsub);
    }catch(e){
      console.warn("request badge setup failed",e);
    }
  }

  function listenActivity(me){
    try{
      const q1=query(collection(db,"notifications"), where("to","==",me.uid));
      const unsub=onSnapshot(q1, snap=>{
        let count=0;
        snap.forEach(d=>{
          const x=d.data();
          if(x.read!==true && x.seen!==true) count++;
        });
        updateBadgeFinal("activity",count);
      }, err=>console.warn("activity badge failed",err));
      kalbBadgeUnsubs.push(unsub);
    }catch(e){
      try{
        const q2=query(collection(db,"activities"));
        const unsub=onSnapshot(q2, snap=>{
          let count=0;
          snap.forEach(d=>{
            const x=d.data();
            if((x.to===me.uid || x.uid===me.uid || x.userId===me.uid) && x.read!==true && x.seen!==true) count++;
          });
          updateBadgeFinal("activity",count);
        });
        kalbBadgeUnsubs.push(unsub);
      }catch(err){ console.warn("activity badge fallback failed",err); }
    }
  }

  function listenCalls(me){
    try{
      const q1=query(collection(db,"calls"), where("to","==",me.uid));
      const unsub=onSnapshot(q1, snap=>{
        let count=0;
        snap.forEach(d=>{
          const x=d.data();
          const status=(x.status||"").toLowerCase();
          if(status==="ringing" || status==="incoming" || status==="pending" || !status) count++;
        });
        updateBadgeFinal("calls",count);
      }, err=>console.warn("call badge failed",err));
      kalbBadgeUnsubs.push(unsub);
    }catch(e){
      console.warn("call badge setup failed",e);
    }
  }

  function listenChats(me){
    try{
      const unsub=onSnapshot(collection(db,"chats"), snap=>{
        let count=0;
        snap.forEach(d=>{
          const x=d.data();
          const users = Array.isArray(x.users) ? x.users :
                        Array.isArray(x.members) ? x.members :
                        String(d.id).split("_");
          if(!users.includes(me.uid)) return;
          const unread = x.unread || x.unreadCount || {};
          if(typeof unread === "object" && unread[me.uid]) count += Number(unread[me.uid] || 0);
          else if(x.lastSender && x.lastSender !== me.uid && x.readBy && Array.isArray(x.readBy) && !x.readBy.includes(me.uid)) count++;
          else if(x.lastSender && x.lastSender !== me.uid && x.seenBy && Array.isArray(x.seenBy) && !x.seenBy.includes(me.uid)) count++;
        });
        updateBadgeFinal("chats",count);
      }, err=>console.warn("chat badge failed",err));
      kalbBadgeUnsubs.push(unsub);
    }catch(e){
      console.warn("chat badge setup failed",e);
    }
  }

  window.startNotificationBadgesFinal=function(){
    ensureBadgesFinal();
    stopBadges();
    const me=badgeUser();
    if(!me){
      updateBadgeFinal("chats",0);
      updateBadgeFinal("requests",0);
      updateBadgeFinal("activity",0);
      updateBadgeFinal("calls",0);
      return;
    }
    listenIncomingRequests(me);
    listenActivity(me);
    listenCalls(me);
    listenChats(me);
  };

  setInterval(ensureBadgesFinal,2500);
  setTimeout(startNotificationBadgesFinal,1200);

  if(typeof onAuthStateChanged==="function" && typeof auth!=="undefined"){
    onAuthStateChanged(auth,user=>{
      setTimeout(startNotificationBadgesFinal,600);
    });
  }
})();



/* UPDATES 7 8 9 MODULE: BADGES WALLPAPER FRIEND SUGGESTIONS */
(function(){
  function uSafe(v){
    if(typeof safe === "function") return safe(v ?? "");
    return String(v ?? "").replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function meUser(){
    try{return currentUser || (typeof auth!=="undefined" ? auth.currentUser : null)}catch(e){return null}
  }
  function profileList(){
    return Array.isArray(allUsers) ? allUsers : [];
  }
  function isAdminFinal(){
    try{
      if(typeof isAppAdmin === "function" && isAppAdmin()) return true;
      return currentUserProfile && (currentUserProfile.role==="admin" || currentUserProfile.admin===true);
    }catch(e){return false}
  }
  window.profileBadgesHtmlFinal=function(user){
    user = user || {};
    const badges = [];
    if(user.verified === true || (Array.isArray(user.badges) && user.badges.includes("verified"))) badges.push(`<span class="user-badge-pill badge-verified">✓ Verified</span>`);
    if(user.creator === true || (Array.isArray(user.badges) && user.badges.includes("creator"))) badges.push(`<span class="user-badge-pill badge-creator">★ Creator</span>`);
    if(user.moderator === true || user.role === "moderator" || (Array.isArray(user.badges) && user.badges.includes("moderator"))) badges.push(`<span class="user-badge-pill badge-moderator">◆ Mod</span>`);
    if(user.banned === true || (Array.isArray(user.badges) && user.badges.includes("banned"))) badges.push(`<span class="user-badge-pill badge-banned">⚠ Banned</span>`);
    if(user.role === "admin") badges.push(`<span class="user-badge-pill badge-verified">👑 Admin</span>`);
    return badges.join("");
  };
  const oldVerifiedHtml = window.verifiedHtml;
  window.verifiedHtml=function(user){
    const old = typeof oldVerifiedHtml === "function" ? oldVerifiedHtml(user) : "";
    const extra = profileBadgesHtmlFinal(user);
    return old && old.includes("user-badge-pill") ? old : (old || "") + extra;
  };

  window.applyProfileBadgesFinal=function(){
    try{
      document.querySelectorAll("[data-user-uid]").forEach(el=>{
        const uid=el.getAttribute("data-user-uid");
        const u=profileList().find(x=>x.uid===uid);
        if(!u || el.querySelector(".user-badge-pill")) return;
        const nameNode=el.querySelector("b,strong,h3,h4,.user-name,.profile-name");
        if(nameNode) nameNode.insertAdjacentHTML("beforeend", profileBadgesHtmlFinal(u));
      });
    }catch(e){}
  };

  window.setChatWallpaperFinal=async function(type){
    const me=meUser();
    type = type || "dark";
    document.body.setAttribute("data-chat-wallpaper", type);
    localStorage.setItem("kalbChatWallpaper", type);
    document.querySelectorAll(".wallpaper-card").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".chat-wallpaper-"+type).forEach(x=>x.classList.add("active"));
    try{
      if(me && typeof db!=="undefined"){
        await updateDoc(doc(db,"users",me.uid),{chatWallpaper:type});
      }
    }catch(e){console.warn("Wallpaper saved locally only",e)}
  };
  window.loadChatWallpaperFinal=function(){
    let type = currentUserProfile?.chatWallpaper || localStorage.getItem("kalbChatWallpaper") || "dark";
    setChatWallpaperFinal(type);
  };

  function myFriendIds(){
    const me=meUser();
    const p=currentUserProfile || {};
    let ids = [];
    if(Array.isArray(p.friends)) ids = ids.concat(p.friends);
    if(Array.isArray(p.friendIds)) ids = ids.concat(p.friendIds);
    if(Array.isArray(p.acceptedFriends)) ids = ids.concat(p.acceptedFriends);
    return [...new Set(ids)].filter(Boolean).filter(x=>!me || x!==me.uid);
  }
  function pendingIds(){
    let ids=[];
    try{
      (window.allFriendRequests || friendRequests || []).forEach(r=>{
        if(r.status==="pending"){
          ids.push(r.to || r.toUid || r.receiverId);
          ids.push(r.from || r.fromUid || r.senderId);
        }
      });
    }catch(e){}
    return [...new Set(ids)].filter(Boolean);
  }
  window.renderFriendSuggestionsFinal=function(){
    const box=document.getElementById("friendSuggestionsBox");
    if(!box)return;
    const me=meUser();
    if(!me){box.innerHTML=`<p class="muted">Login first.</p>`;return}
    const friends=myFriendIds();
    const pend=pendingIds();
    const users=profileList()
      .filter(u=>u.uid && u.uid!==me.uid)
      .filter(u=>!friends.includes(u.uid))
      .filter(u=>!pend.includes(u.uid))
      .slice(0,8);

    if(!users.length){
      box.innerHTML=`<p class="muted">No suggestions right now.</p>`;
      return;
    }
    box.innerHTML=users.map(u=>{
      const name=uSafe(u.name || u.displayName || u.username || (u.email||"User").split("@")[0]);
      const username=uSafe(u.username || (u.email||"user").split("@")[0]);
      const avatar=uSafe(u.avatarEmoji || "👤");
      return `<div class="friend-suggestion-card" data-user-uid="${u.uid}">
        <div class="avatar" style="background:${typeof avatarStyle==="function"?avatarStyle(u.avatarColor):"linear-gradient(135deg,#22d3ee,#a855f7)"}">${avatar}</div>
        <div style="flex:1;min-width:0">
          <b>${name} ${profileBadgesHtmlFinal(u)}</b>
          <p class="muted" style="margin:2px 0 0">@${username}</p>
        </div>
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>
        <button class="btn small" onclick='sendFriendRequest("${u.uid}")'>Add</button>
      </div>`;
    }).join("");
  };

  window.adminAddBadgeFinal=async function(){
    if(!isAdminFinal()) return alert("Admin only.");
    const uid=document.getElementById("badgeUserIdInput")?.value.trim();
    const badge=document.getElementById("badgeTypeInput")?.value;
    if(!uid || !badge) return alert("Enter user UID and select badge.");
    const user=profileList().find(u=>u.uid===uid) || {};
    const badges=Array.isArray(user.badges) ? [...user.badges] : [];
    if(!badges.includes(badge)) badges.push(badge);
    const data={badges};
    if(badge==="verified") data.verified=true;
    if(badge==="creator") data.creator=true;
    if(badge==="moderator") data.moderator=true;
    if(badge==="banned") data.banned=true;
    await updateDoc(doc(db,"users",uid),data);
    alert("Badge added.");
  };
  window.adminRemoveBadgeFinal=async function(){
    if(!isAdminFinal()) return alert("Admin only.");
    const uid=document.getElementById("badgeUserIdInput")?.value.trim();
    const badge=document.getElementById("badgeTypeInput")?.value;
    if(!uid || !badge) return alert("Enter user UID and select badge.");
    const user=profileList().find(u=>u.uid===uid) || {};
    const badges=(Array.isArray(user.badges) ? user.badges : []).filter(x=>x!==badge);
    const data={badges};
    if(badge==="verified") data.verified=false;
    if(badge==="creator") data.creator=false;
    if(badge==="moderator") data.moderator=false;
    if(badge==="banned") data.banned=false;
    await updateDoc(doc(db,"users",uid),data);
    alert("Badge removed.");
  };

  function hideAdminBadgeForNormal(){
    const card=document.getElementById("adminBadgeControlsCard");
    if(card) card.style.display = isAdminFinal() ? "" : "none";
  }

  const oldOpenPage789 = window.openPage;
  if(typeof oldOpenPage789==="function" && !window.__updates789OpenWrapped){
    window.__updates789OpenWrapped=true;
    window.openPage=function(id,navEl){
      const r=oldOpenPage789(id,navEl);
      setTimeout(()=>{
        renderFriendSuggestionsFinal();
        applyProfileBadgesFinal();
        loadChatWallpaperFinal();
        hideAdminBadgeForNormal();
      },150);
      return r;
    };
  }

  setTimeout(()=>{
    loadChatWallpaperFinal();
    renderFriendSuggestionsFinal();
    applyProfileBadgesFinal();
    hideAdminBadgeForNormal();
  },1200);
  setInterval(()=>{
    renderFriendSuggestionsFinal();
    applyProfileBadgesFinal();
    hideAdminBadgeForNormal();
  },5000);

  if(typeof onAuthStateChanged==="function" && typeof auth!=="undefined"){
    onAuthStateChanged(auth,()=>setTimeout(()=>{
      loadChatWallpaperFinal();
      renderFriendSuggestionsFinal();
      hideAdminBadgeForNormal();
    },700));
  }
})();



/* KALB STICKER STORE + COINS + CHAT SEND */
const KALB_STICKER_PACKS = [
  {id:'free_fun', name:'Free Fun Pack', price:0, icon:'😀', desc:'Basic free stickers for everyone.', stickers:['😀','😂','😎','🔥','👍','❤️','🙏','😮']},
  {id:'free_kalb', name:'Kalb Free Pack', price:0, icon:'💬', desc:'Simple Kalb chat stickers.', stickers:['Hi','OK','GG','Wow','Thanks','Done','Sorry','Bye'], text:true},
  {id:'premium_gamer', name:'Gamer Pack', price:70, icon:'🎮', desc:'Premium gaming stickers unlocked by coins.', stickers:['🎮','🏆','⚔️','💥','👑','🕹️','GG','WIN'], text:false},
  {id:'premium_neon', name:'Neon Pack', price:90, icon:'🌈', desc:'Neon premium reaction stickers.', stickers:['✨','💜','⚡','🌟','💎','🚀','OP','VIBE'], text:false},
  {id:'premium_love', name:'Love Pack', price:80, icon:'💖', desc:'Premium love and friendship stickers.', stickers:['💖','💘','🥰','😍','🤝','🌹','MISS U','BESTIE'], text:false},
  {id:'premium_gold', name:'Gold VIP Pack', price:120, icon:'🏆', desc:'VIP gold stickers for premium style.', stickers:['🏆','👑','💰','⭐','🥇','🔥','VIP','PRO'], text:false}
];
let kalbActiveStickerPack = 'free_fun';
function kalbStickerStatus(text,error=false,chat=false){
  const el=document.getElementById(chat?'kalbStickerChatStatus':'kalbStickerStoreStatus');
  if(el) el.innerHTML='<div class="notice '+(error?'err':'')+'">'+safe(text)+'</div>';
}
function kalbOwnedStickerPacks(u){
  const arr=Array.isArray(u?.ownedStickerPacks)?u.ownedStickerPacks:[];
  const set=new Set(arr);
  KALB_STICKER_PACKS.forEach(p=>{if(!p.price)set.add(p.id)});
  return Array.from(set);
}
function kalbCustomStickers(u){return Array.isArray(u?.customStickers)?u.customStickers.slice(0,30):[];}
function kalbStickerPackById(id){return KALB_STICKER_PACKS.find(p=>p.id===id)||KALB_STICKER_PACKS[0];}
function kalbUserOwnsStickerPack(id){return kalbOwnedStickerPacks(currentUserProfile||{}).includes(id);}
function kalbStickerStyle(packId){
  if(packId==='premium_gold')return 'background:linear-gradient(135deg,#f59e0b,#facc15);color:#211400';
  if(packId==='premium_neon')return 'background:linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899);color:#fff';
  if(packId==='premium_love')return 'background:linear-gradient(135deg,#be185d,#ec4899,#fb7185);color:#fff';
  if(packId==='premium_gamer')return 'background:linear-gradient(135deg,#052e16,#16a34a,#06b6d4);color:#fff';
  if(packId==='custom_text')return 'background:linear-gradient(135deg,#0f172a,#334155);color:#fff';
  if(packId==='free_kalb')return 'background:linear-gradient(135deg,#1e293b,#0891b2);color:#fff';
  return '';
}
function renderKalbMessageBody(m){
  if(m && m.type==='sticker'){
    const s=m.sticker||{};
    const text=s.value||s.text||m.text||'🎟️';
    const isText=s.isText || String(text).length>2;
    const style=kalbStickerStyle(s.packId||'');
    return `<div class="kalb-chat-sticker ${isText?'text':''}" style="${style}">${safe(text)}</div>`;
  }
  return `<p>${safe(m?.text||'')}</p>`;
}
window.renderKalbStickerStore=function(){
  const coins=kalbCoinsNum((currentUserProfile||{}).kalbCoins);
  const balance=document.getElementById('kalbStickerCoinBalance'); if(balance) balance.innerText=coins;
  const box=document.getElementById('kalbStickerPackStore');
  if(box){
    const owned=kalbOwnedStickerPacks(currentUserProfile||{});
    box.innerHTML=KALB_STICKER_PACKS.map(pack=>{
      const has=owned.includes(pack.id);
      const preview=pack.stickers.slice(0,5).map(x=>`<span class="kalb-sticker-chip ${String(x).length>2?'text':''}" style="${kalbStickerStyle(pack.id)}">${safe(x)}</span>`).join('');
      return `<div class="kalb-sticker-pack ${has?'owned':''}">
        <h4>${pack.icon} ${safe(pack.name)}</h4>
        <p class="muted">${safe(pack.desc)}</p>
        <div class="kalb-sticker-preview">${preview}</div>
        <span class="kalb-sticker-price">${pack.price?pack.price+' 🪙':'Free'}</span>
        <div class="actions">
          <button class="btn small ${has?'green':''}" onclick="kalbBuyStickerPack('${pack.id}')">${has?'Unlocked':(pack.price?'Buy Pack':'Unlock Free')}</button>
          <button class="btn small" onclick="kalbOpenPackInPicker('${pack.id}')">Use</button>
        </div>
      </div>`;
    }).join('');
  }
  window.renderKalbStickerPicker();
};
window.kalbBuyStickerPack=async function(packId){
  if(!currentUser) return alert('Login first.');
  const pack=kalbStickerPackById(packId);
  const ref=doc(db,'users',currentUser.uid);
  let data=currentUserProfile||{};
  try{const snap=await getDoc(ref); if(snap.exists()) data={...data,...snap.data()};}catch(e){}
  const owned=kalbOwnedStickerPacks(data);
  if(owned.includes(packId)) return kalbStickerStatus(pack.name+' is already unlocked.');
  const coins=kalbCoinsNum(data.kalbCoins);
  if(pack.price && coins<pack.price) return kalbStickerStatus('Not enough Kalb Coins. Need '+pack.price+' coins.',true);
  const nextOwned=Array.from(new Set([...owned,packId]));
  const nextCoins=pack.price?coins-pack.price:coins;
  try{
    await setDoc(ref,{kalbCoins:nextCoins,ownedStickerPacks:nextOwned,stickersUpdatedAt:serverTimestamp()},{merge:true});
    currentUserProfile={...data,kalbCoins:nextCoins,ownedStickerPacks:nextOwned};
    kalbStickerStatus('Unlocked '+pack.name+'.');
    try{if(typeof window.kalbRenderCoinsSystem==='function')window.kalbRenderCoinsSystem();}catch(e){}
    window.renderKalbStickerStore();
  }catch(e){console.error(e); kalbStickerStatus(e.message||'Could not unlock sticker pack.',true);}
};
window.kalbOpenPackInPicker=function(packId){
  kalbActiveStickerPack=packId||'free_fun';
  const p=document.getElementById('kalbStickerPicker'); if(p) p.classList.add('active');
  window.renderKalbStickerPicker();
  const chat=document.getElementById('messagesBox'); if(chat) setTimeout(()=>p?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
};
window.toggleKalbStickerPicker=function(force){
  const p=document.getElementById('kalbStickerPicker'); if(!p) return;
  if(typeof force==='boolean') p.classList.toggle('active',force); else p.classList.toggle('active');
  window.renderKalbStickerPicker();
};
window.renderKalbStickerPicker=function(){
  const tabs=document.getElementById('kalbStickerPickerTabs');
  const grid=document.getElementById('kalbStickerPickerGrid');
  if(!tabs||!grid) return;
  const custom=kalbCustomStickers(currentUserProfile||{});
  const packs=[...KALB_STICKER_PACKS];
  tabs.innerHTML=packs.map(p=>`<button class="kalb-sticker-tab ${kalbActiveStickerPack===p.id?'active':''}" onclick="kalbSelectStickerPack('${p.id}')">${p.icon} ${safe(p.name.replace(' Pack',''))}</button>`).join('')+(custom.length?`<button class="kalb-sticker-tab ${kalbActiveStickerPack==='custom_text'?'active':''}" onclick="kalbSelectStickerPack('custom_text')">✍️ Mine</button>`:'');
  if(kalbActiveStickerPack==='custom_text'){
    grid.innerHTML=custom.length?custom.map((s,i)=>`<button class="kalb-sticker-send" style="${kalbStickerStyle('custom_text')}" onclick="sendKalbSavedCustomSticker(${i})">${safe(s.text||'Text')}</button>`).join(''):'<div class="empty">No saved text stickers yet.</div>';
    return;
  }
  const pack=kalbStickerPackById(kalbActiveStickerPack);
  const owned=kalbUserOwnsStickerPack(pack.id);
  grid.innerHTML=pack.stickers.map((st,i)=>`<button class="kalb-sticker-send ${owned?'':'locked'}" style="${kalbStickerStyle(pack.id)}" onclick="sendKalbSticker('${pack.id}',${i})">${safe(st)}</button>`).join('');
};
window.kalbSelectStickerPack=function(packId){kalbActiveStickerPack=packId; window.renderKalbStickerPicker();};
async function kalbSendStickerMessage(sticker){
  if(await isCurrentUserBanned()) return alert('Your account is banned.');
  if(!currentUser || !currentChatId || !currentChatUser) return alert('Open a chat first.');
  try{
    if(typeof window.__kalbCurrentChatUid!=='undefined'){
      const uid=window.__kalbCurrentChatUid||currentChatUser.uid;
      if(typeof window.canTalkTo==='function' && uid && !window.canTalkTo(uid)) return alert('Messages are disabled for this user.');
    }
  }catch(e){}
  const meSnap=await getDoc(doc(db,'users',currentUser.uid));
  const me=meSnap.exists()?meSnap.data():(currentUserProfile||{});
  restoreDeletedChat(currentChatId);
  setArchivedChats(getArchivedChats().filter(x=>x!==currentChatId));
  await setDoc(doc(db,'chats',currentChatId),{
    members:[currentUser.uid,currentChatUser.uid],
    memberNames:{[currentUser.uid]:me.name||currentUser.displayName||currentUser.email||'User',[currentChatUser.uid]:currentChatUser.name||currentChatUser.email||'User'},
    lastMessage:'🎟️ Sticker',
    lastMessageAt:serverTimestamp(),lastSenderUid:currentUser.uid,updatedAt:serverTimestamp()
  },{merge:true});
  await addDoc(collection(db,'chats',currentChatId,'messages'),{
    type:'sticker',text:'[Sticker]',sticker,
    replyText:currentReply?currentReply.text:'',replyTo:currentReply?currentReply.id:'',
    senderUid:currentUser.uid,senderEmail:currentUser.email||'',senderName:me.name||currentUser.displayName||'User',createdAt:serverTimestamp(),seen:false
  });
  currentReply=null; if(typeof updateReplyBar==='function')updateReplyBar();
  try{renderChatListCache();}catch(e){}
}
window.sendKalbSticker=async function(packId,index){
  const pack=kalbStickerPackById(packId);
  if(!kalbUserOwnsStickerPack(packId)) return kalbStickerStatus('Buy first to use '+pack.name+'.',true,true);
  const value=pack.stickers[index]||pack.icon||'🎟️';
  await kalbSendStickerMessage({packId,value,isText:String(value).length>2,name:pack.name});
  kalbStickerStatus('Sticker sent.',false,true);
};
window.sendKalbTextStickerNow=async function(){
  const input=document.getElementById('kalbChatTextStickerInput');
  const text=(input?.value||'').trim();
  if(!text) return kalbStickerStatus('Type text for sticker first.',true,true);
  await kalbSendStickerMessage({packId:'custom_text',value:text,isText:true,name:'Text Sticker'});
  if(input) input.value='';
  kalbStickerStatus('Text sticker sent.',false,true);
};
window.sendKalbSavedCustomSticker=async function(index){
  const custom=kalbCustomStickers(currentUserProfile||{});
  const st=custom[index]; if(!st) return;
  await kalbSendStickerMessage({packId:'custom_text',value:st.text||'Text',isText:true,name:'Saved Text Sticker'});
};
window.kalbSaveCustomTextSticker=async function(inputId){
  if(!currentUser) return alert('Login first.');
  const input=document.getElementById(inputId);
  const text=(input?.value||'').trim();
  if(!text) return kalbStickerStatus('Type text first.',true,inputId==='kalbChatTextStickerInput');
  const old=currentUserProfile||{};
  const list=kalbCustomStickers(old).filter(s=>String(s.text||'').toLowerCase()!==text.toLowerCase());
  const next=[{id:'txt_'+Date.now(),text:text.slice(0,32)},...list].slice(0,20);
  try{
    await setDoc(doc(db,'users',currentUser.uid),{customStickers:next,stickersUpdatedAt:serverTimestamp()},{merge:true});
    currentUserProfile={...old,customStickers:next};
    if(input) input.value='';
    kalbStickerStatus('Text sticker saved.',false,inputId==='kalbChatTextStickerInput');
    window.renderKalbStickerStore();
  }catch(e){console.error(e); kalbStickerStatus(e.message||'Could not save text sticker.',true,inputId==='kalbChatTextStickerInput');}
};
const oldKalbStickerOpenPage=window.openPage;
if(typeof oldKalbStickerOpenPage==='function' && !window.__kalbStickerOpenWrapped){
  window.__kalbStickerOpenWrapped=true;
  window.openPage=function(id,navEl){
    const r=oldKalbStickerOpenPage(id,navEl);
    if(id==='settingsPage' || id==='chatRoomPage') setTimeout(()=>{try{window.renderKalbStickerStore();}catch(e){}},120);
    return r;
  };
}
setTimeout(()=>{try{window.renderKalbStickerStore();}catch(e){}},1200);
setTimeout(()=>{try{window.renderKalbStickerStore();}catch(e){}},2600);
try{onAuthStateChanged(auth,()=>setTimeout(()=>{try{window.renderKalbStickerStore();}catch(e){}},900));}catch(e){}

