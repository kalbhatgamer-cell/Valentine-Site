
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const ADMIN_EMAIL='kalbhatgamer@gmail.com';
const DAILY=25;
const REWARDS=[
  {id:'gold_frame',name:'Golden Profile Frame',price:100,icon:'🏆',desc:'Premium golden frame for your profile.'},
  {id:'name_glow',name:'Name Glow',price:150,icon:'✨',desc:'Special glowing profile name reward.'},
  {id:'gamer_badge',name:'Gamer Badge',price:80,icon:'🎮',desc:'Gaming reward badge for active players.'},
  {id:'vip_bubble',name:'VIP Chat Bubble',price:180,icon:'💬',desc:'Premium chat bubble style reward.'},
  {id:'amethyst_theme',name:'Amethyst Theme Pack',price:120,icon:'💜',desc:'Purple premium theme reward.'},
  {id:'creator_boost',name:'Creator Boost',price:220,icon:'🚀',desc:'Creator style profile boost reward.'}
];
let usersCache=[];
let currentMe=null;
let unsubUsers=null;
function el(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function n(v){const x=Number(v||0);return Number.isFinite(x)?Math.max(0,Math.floor(x)):0}
function owned(u){return Array.isArray(u&&u.ownedRewards)?u.ownedRewards:[]}
function isAdmin(){const u=auth.currentUser;return !!u && String(u.email||'').toLowerCase()===ADMIN_EMAIL}
function today(){return new Date().toISOString().slice(0,10)}
function status(id,msg,bad=false){const box=el(id);if(box)box.innerHTML=msg?`<div class="notice ${bad?'err':''}">${esc(msg)}</div>`:''}
async function getUserDoc(uid){
  const s=await getDoc(doc(db,'users',uid));
  return s.exists()?{uid:s.id,...s.data()}:null;
}
async function ensureMyCoinFields(){
  const u=auth.currentUser;if(!u)return null;
  let me=await getUserDoc(u.uid);
  if(!me){
    await setDoc(doc(db,'users',u.uid),{uid:u.uid,email:u.email||'',name:u.displayName||'User',kalbCoins:0,ownedRewards:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    me=await getUserDoc(u.uid);
  }
  const patch={};
  if(typeof me.kalbCoins==='undefined')patch.kalbCoins=0;
  if(!Array.isArray(me.ownedRewards))patch.ownedRewards=[];
  if(Object.keys(patch).length){
    await setDoc(doc(db,'users',u.uid),patch,{merge:true});
    me={...me,...patch};
  }
  currentMe=me;
  return me;
}
async function loadUsersOnce(){
  try{
    const snap=await getDocs(collection(db,'users'));
    usersCache=[];
    snap.forEach(d=>usersCache.push({uid:d.id,...d.data()}));
    if(!usersCache.find(x=>x.uid===auth.currentUser?.uid) && currentMe)usersCache.push(currentMe);
  }catch(e){console.warn('Coins users load failed',e)}
  return usersCache;
}
function renderStore(me){
  const box=el('kalbRewardsStore');
  if(!box)return;
  const have=owned(me);
  box.innerHTML=REWARDS.map(r=>{
    const has=have.includes(r.id);
    return `<div class="kalb-reward-card ${has?'kalb-reward-owned':''}">
      <h4>${r.icon} ${esc(r.name)}</h4>
      <p>${esc(r.desc)}</p>
      <span class="kalb-reward-price">${r.price} 🪙</span>
      <button class="btn small ${has?'green':''}" onclick="kalbBuyReward('${r.id}')">${has?'Owned':'Buy'}</button>
    </div>`;
  }).join('');
}
function renderLeaderboard(me){
  const box=el('kalbCoinsLeaderboard');
  const rank=el('kalbLeaderboardRank');
  const users=(usersCache||[]).slice().sort((a,b)=>n(b.kalbCoins)-n(a.kalbCoins));
  const idx=users.findIndex(u=>u.uid===auth.currentUser?.uid);
  if(rank)rank.innerText=idx>=0?'#'+(idx+1):'—';
  if(!box)return;
  box.innerHTML=users.length?users.slice(0,10).map((u,i)=>`<div class="kalb-leader-row">
    <div class="kalb-rank">${i+1}</div>
    <div><h4>${esc(u.name||u.displayName||u.email||'User')}</h4><p>@${esc(u.username||String(u.email||'user').split('@')[0]||'user')}</p></div>
    <div class="kalb-leader-coins">${n(u.kalbCoins)} 🪙</div>
  </div>`).join(''):'<div class="empty">No users found yet.</div>';
}
function renderAdmin(){
  const card=el('adminCoinsControlsCard');
  if(card){card.classList.toggle('hidden',!isAdmin());card.style.display=isAdmin()?'':'none'}
  const sel=el('adminCoinsUserSelect');
  if(!sel)return;
  const old=sel.value;
  const users=(usersCache||[]).slice().sort((a,b)=>String(a.name||a.email||'').localeCompare(String(b.name||b.email||'')));
  sel.innerHTML='<option value="">Select user</option>'+users.map(u=>`<option value="${esc(u.uid)}">${esc(u.name||u.displayName||u.email||'User')} — ${n(u.kalbCoins)} coins</option>`).join('');
  if(old && users.find(u=>u.uid===old))sel.value=old;
}
function renderGamesNote(){
  const note=el('gamesCoinsRewardNote');
  if(note)note.innerHTML='🏆 Game rewards active: Tic Tac Toe win +10 coins, Quiz win +15 coins, Truth/Dare answer +5 coins. Check Settings → Kalb Coins Wallet.';
}
async function renderAll(msg=''){
  const u=auth.currentUser;if(!u)return;
  const me=await ensureMyCoinFields().catch(()=>currentMe||{});
  await loadUsersOnce();
  const coins=n(me&&me.kalbCoins);
  if(el('kalbCoinBalance'))el('kalbCoinBalance').innerText=coins;
  if(el('profileCoinsCount'))el('profileCoinsCount').innerText=coins;
  if(el('kalbDailyRewardAmount'))el('kalbDailyRewardAmount').innerText='+'+DAILY;
  if(el('kalbOwnedRewardsCount'))el('kalbOwnedRewardsCount').innerText=owned(me).length;
  renderStore(me||{});renderLeaderboard(me||{});renderAdmin();renderGamesNote();
  if(msg)status('kalbCoinsStatus',msg,false);
}
window.kalbRenderCoinsSystem=function(){renderAll().catch(e=>console.warn(e));};
window.kalbClaimDailyCoins=async function(){
  try{
    const u=auth.currentUser;if(!u)return alert('Login first.');
    const me=await ensureMyCoinFields();
    if(me.lastCoinClaimDate===today())return status('kalbCoinsStatus','You already claimed today. Come back tomorrow.',true);
    const next=n(me.kalbCoins)+DAILY;
    await setDoc(doc(db,'users',u.uid),{kalbCoins:next,lastCoinClaimDate:today(),coinsUpdatedAt:serverTimestamp()},{merge:true});
    currentMe={...me,kalbCoins:next,lastCoinClaimDate:today()};
    await renderAll('Daily reward claimed: +'+DAILY+' coins.');
  }catch(e){console.error(e);status('kalbCoinsStatus',e.message||'Could not claim daily coins. Check Firebase rules.',true)}
};
window.kalbBuyReward=async function(id){
  try{
    const u=auth.currentUser;if(!u)return alert('Login first.');
    const item=REWARDS.find(r=>r.id===id);if(!item)return;
    const me=await ensureMyCoinFields();
    const have=owned(me);
    if(have.includes(id))return status('kalbCoinsStatus',item.name+' is already owned.',false);
    const coins=n(me.kalbCoins);
    if(coins<item.price)return status('kalbCoinsStatus','Not enough Kalb Coins for '+item.name+'.',true);
    const nextOwned=[...have,id];
    await setDoc(doc(db,'users',u.uid),{kalbCoins:coins-item.price,ownedRewards:nextOwned,coinsUpdatedAt:serverTimestamp()},{merge:true});
    currentMe={...me,kalbCoins:coins-item.price,ownedRewards:nextOwned};
    await renderAll('Purchased: '+item.name+'.');
  }catch(e){console.error(e);status('kalbCoinsStatus',e.message||'Purchase failed.',true)}
};
async function adminChangeCoins(sign){
  try{
    if(!isAdmin())return alert('Admin only.');
    const uid=el('adminCoinsUserSelect')?.value||'';
    const amount=Math.max(1,Math.floor(Number(el('adminCoinsAmount')?.value||0)));
    if(!uid)return status('adminCoinsStatus','Select a user first.',true);
    const user=await getUserDoc(uid)||{};
    const next=Math.max(0,n(user.kalbCoins)+(sign*amount));
    await setDoc(doc(db,'users',uid),{kalbCoins:next,coinsUpdatedAt:serverTimestamp()},{merge:true});
    status('adminCoinsStatus',(sign>0?'Added ':'Removed ')+amount+' coins successfully.',false);
    await renderAll();
  }catch(e){console.error(e);status('adminCoinsStatus',e.message||'Coins update failed. Check Firebase rules.',true)}
}
window.adminAddKalbCoins=function(){adminChangeCoins(1)};
window.adminRemoveKalbCoins=function(){adminChangeCoins(-1)};
async function awardGameCoins(amount,reason){
  try{
    const u=auth.currentUser;if(!u)return;
    const key='kalbGameCoinAward_'+u.uid+'_'+reason+'_'+Math.floor(Date.now()/15000);
    if(localStorage.getItem(key))return;
    localStorage.setItem(key,'1');
    const me=await ensureMyCoinFields();
    const next=n(me.kalbCoins)+amount;
    await setDoc(doc(db,'users',u.uid),{kalbCoins:next,coinsUpdatedAt:serverTimestamp()},{merge:true});
    currentMe={...me,kalbCoins:next};
    const note=el('gamesCoinsRewardNote');
    if(note)note.innerHTML='✅ Game reward added: +'+amount+' coins for '+esc(reason)+'.';
    await renderAll();
  }catch(e){console.warn('Game coin award failed',e)}
}
window.kalbAwardGameCoins=awardGameCoins;
function wrapGameRewardButtons(){
  if(window.__kalbCoinsGameWrapDone)return;
  const tryWrap=()=>{
    let wrapped=false;
    if(typeof window.kalbTicMove==='function' && !window.kalbTicMove.__coinsWrapped){
      const old=window.kalbTicMove;
      window.kalbTicMove=function(){const r=old.apply(this,arguments);setTimeout(()=>{const t=(el('gamesHubStatus')?.innerText||'');if(/You won/i.test(t))awardGameCoins(10,'Tic Tac Toe win')},650);return r};
      window.kalbTicMove.__coinsWrapped=true;wrapped=true;
    }
    if(typeof window.kalbQuizAnswer==='function' && !window.kalbQuizAnswer.__coinsWrapped){
      const old=window.kalbQuizAnswer;
      window.kalbQuizAnswer=function(){const before=(el('gamesHubStatus')?.innerText||'');const r=old.apply(this,arguments);setTimeout(()=>{const after=(el('gamesHubStatus')?.innerText||'');if(!/You win/i.test(before)&&/You win/i.test(after))awardGameCoins(15,'Quiz win')},120);return r};
      window.kalbQuizAnswer.__coinsWrapped=true;wrapped=true;
    }
    if(typeof window.kalbSubmitTruthDareAnswer==='function' && !window.kalbSubmitTruthDareAnswer.__coinsWrapped){
      const old=window.kalbSubmitTruthDareAnswer;
      window.kalbSubmitTruthDareAnswer=function(){const answer=(el('truthDareAnswer')?.value||'').trim();const r=old.apply(this,arguments);if(answer)awardGameCoins(5,'Truth or Dare answer');return r};
      window.kalbSubmitTruthDareAnswer.__coinsWrapped=true;wrapped=true;
    }
    if(typeof window.kalbTruthDareDone==='function' && !window.kalbTruthDareDone.__coinsWrapped){
      const old=window.kalbTruthDareDone;
      window.kalbTruthDareDone=function(){const r=old.apply(this,arguments);awardGameCoins(5,'Truth or Dare completion');return r};
      window.kalbTruthDareDone.__coinsWrapped=true;wrapped=true;
    }
    if(wrapped){window.__kalbCoinsGameWrapDone=true;renderGamesNote();}
  };
  tryWrap();setTimeout(tryWrap,700);setTimeout(tryWrap,1800);
}
function boot(){renderGamesNote();wrapGameRewardButtons();if(auth.currentUser)renderAll().catch(console.warn)}
document.addEventListener('DOMContentLoaded',boot);
window.addEventListener('load',()=>setTimeout(boot,500));
setTimeout(boot,1200);setInterval(()=>{renderGamesNote();wrapGameRewardButtons();renderAdmin();},3000);
onAuthStateChanged(auth,async u=>{
  currentMe=null;
  if(unsubUsers){try{unsubUsers()}catch(e){}unsubUsers=null;}
  if(u){
    try{await ensureMyCoinFields()}catch(e){console.warn(e)}
    try{unsubUsers=onSnapshot(collection(db,'users'),snap=>{usersCache=[];snap.forEach(d=>usersCache.push({uid:d.id,...d.data()}));const mine=usersCache.find(x=>x.uid===u.uid);if(mine)currentMe=mine;renderAll().catch(console.warn);},e=>console.warn('coins user listener',e));}catch(e){console.warn(e)}
    renderAll().catch(console.warn);
  }
});
