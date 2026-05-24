
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const ACH=[
  {id:'welcome',icon:'👋',name:'Welcome to Kalb',desc:'Login and open your account.',check:u=>true},
  {id:'daily_1',icon:'🔥',name:'Daily Starter',desc:'Claim your first daily streak.',check:u=>num(u.kalbStreak)>=1},
  {id:'daily_3',icon:'🔥',name:'3 Day Streak',desc:'Keep your streak for 3 days.',check:u=>num(u.kalbStreak)>=3 || num(u.kalbBestStreak)>=3},
  {id:'daily_7',icon:'🏆',name:'7 Day Champion',desc:'Reach a 7 day streak.',check:u=>num(u.kalbStreak)>=7 || num(u.kalbBestStreak)>=7},
  {id:'level_3',icon:'⬆️',name:'Rising User',desc:'Reach Level 3.',check:u=>levelFromXP(num(u.kalbXP)).level>=3},
  {id:'level_5',icon:'⭐',name:'Kalb Pro',desc:'Reach Level 5.',check:u=>levelFromXP(num(u.kalbXP)).level>=5},
  {id:'game_player',icon:'🎮',name:'Game Player',desc:'Earn XP from Games Hub.',check:u=>(u.kalbAchievementFlags||{}).gamePlayer || num(u.kalbGameXP)>0},
  {id:'coin_collector',icon:'🪙',name:'Coin Collector',desc:'Hold 100 or more Kalb Coins.',check:u=>num(u.kalbCoins)>=100},
  {id:'reward_owner',icon:'💎',name:'Reward Owner',desc:'Own any reward/sticker/theme item.',check:u=>Array.isArray(u.ownedRewards)&&u.ownedRewards.length>0},
  {id:'legend',icon:'👑',name:'Kalb Legend',desc:'Reach Level 10.',check:u=>levelFromXP(num(u.kalbXP)).level>=10}
];
let usersCache=[]; let meCache=null; let unsubUsers=null;
function el(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function num(v){const n=Number(v||0);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0}
function today(){return new Date().toISOString().slice(0,10)}
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)}
function levelFromXP(xp){
  xp=num(xp); const level=Math.max(1,Math.floor(xp/100)+1); const current=(level-1)*100; const next=level*100; const pct=Math.min(100,Math.max(0,Math.round(((xp-current)/(next-current))*100)));
  let title='Newbie'; if(level>=20)title='Legend'; else if(level>=15)title='Elite'; else if(level>=10)title='Star'; else if(level>=5)title='Pro'; else if(level>=3)title='Active';
  return {level,title,current,next,pct,remain:Math.max(0,next-xp)};
}
function status(msg,bad=false){const box=el('kalbAchievementsStatus'); if(box)box.innerHTML=msg?`<div class="notice ${bad?'err':''}">${esc(msg)}</div>`:'';}
function storageKey(uid){return 'kalbAchievementsCache_'+(uid||auth.currentUser?.uid||'guest')}
function readLocal(uid){try{return JSON.parse(localStorage.getItem(storageKey(uid))||'{}')||{}}catch(e){return {}}}
function writeLocal(uid,data){try{localStorage.setItem(storageKey(uid),JSON.stringify(data||{}))}catch(e){}}
async function getMe(){
  const u=auth.currentUser; if(!u)return null;
  let docData=null;
  try{const s=await getDoc(doc(db,'users',u.uid)); docData=s.exists()?{uid:s.id,...s.data()}:null;}catch(e){console.warn('achievement user load failed',e)}
  const local=readLocal(u.uid);
  const base={uid:u.uid,email:u.email||'',name:u.displayName||'User',kalbXP:0,kalbStreak:0,kalbBestStreak:0,kalbAchievements:[],...local,...(docData||{})};
  const patch={};
  if(typeof base.kalbXP==='undefined')patch.kalbXP=0;
  if(typeof base.kalbStreak==='undefined')patch.kalbStreak=0;
  if(typeof base.kalbBestStreak==='undefined')patch.kalbBestStreak=0;
  if(!Array.isArray(base.kalbAchievements))patch.kalbAchievements=[];
  if(Object.keys(patch).length){try{await setDoc(doc(db,'users',u.uid),patch,{merge:true});}catch(e){console.warn(e)} Object.assign(base,patch)}
  meCache=base; writeLocal(u.uid,base); return base;
}
function achievementIdsFor(u){return ACH.filter(a=>{try{return !!a.check(u||{})}catch(e){return false}}).map(a=>a.id)}
async function syncAchievements(extraPatch={}){
  const u=auth.currentUser; if(!u)return null;
  const me={...(await getMe()||{}),...extraPatch};
  const existing=Array.isArray(me.kalbAchievements)?me.kalbAchievements:[];
  const unlocked=Array.from(new Set([...existing,...achievementIdsFor(me)]));
  const data={...extraPatch,kalbAchievements:unlocked,kalbLevel:levelFromXP(num(me.kalbXP)).level,kalbLevelTitle:levelFromXP(num(me.kalbXP)).title,achievementsUpdatedAt:serverTimestamp()};
  meCache={...me,...data}; writeLocal(u.uid,{...meCache,achievementsUpdatedAt:Date.now()});
  try{await setDoc(doc(db,'users',u.uid),data,{merge:true});}catch(e){console.warn('achievement sync firestore failed',e);}
  return meCache;
}
function renderProfileMini(me){
  if(el('profileLevelCount')) el('profileLevelCount').innerText=levelFromXP(num(me?.kalbXP)).level;
  if(el('profileStreakCount')) el('profileStreakCount').innerText=num(me?.kalbStreak);
  const name=el('profileDisplayName');
  if(name && !document.getElementById('kalbProfileLevelMini')){
    const p=document.createElement('div'); p.id='kalbProfileLevelMini'; p.className='kalb-profile-level-mini'; p.innerHTML='🏅 Level <span id="kalbProfileLevelMiniNum">1</span> · <span id="kalbProfileLevelMiniTitle">Newbie</span>'; name.insertAdjacentElement('afterend',p);
  }
  const lv=levelFromXP(num(me?.kalbXP)); if(el('kalbProfileLevelMiniNum'))el('kalbProfileLevelMiniNum').innerText=lv.level; if(el('kalbProfileLevelMiniTitle'))el('kalbProfileLevelMiniTitle').innerText=lv.title;
}
function renderAchievements(me){
  me=me||{}; const lv=levelFromXP(num(me.kalbXP)); const unlocked=new Set(Array.isArray(me.kalbAchievements)?me.kalbAchievements:achievementIdsFor(me));
  if(el('kalbLevelBadge'))el('kalbLevelBadge').innerText=lv.level;
  if(el('kalbLevelTitle'))el('kalbLevelTitle').innerText=lv.title;
  if(el('kalbXPCount'))el('kalbXPCount').innerText=num(me.kalbXP);
  if(el('kalbStreakCount'))el('kalbStreakCount').innerText=num(me.kalbStreak);
  if(el('kalbBestStreakCount'))el('kalbBestStreakCount').innerText=num(me.kalbBestStreak);
  if(el('kalbAchievementCount'))el('kalbAchievementCount').innerText=unlocked.size+'/'+ACH.length;
  if(el('kalbXPFill'))el('kalbXPFill').style.width=lv.pct+'%';
  if(el('kalbXPLabel'))el('kalbXPLabel').innerText=`${num(me.kalbXP)-lv.current} / 100 XP to Level ${lv.level+1}`;
  if(el('kalbLevelProgressLabel'))el('kalbLevelProgressLabel').innerText=lv.pct+'%';
  const list=el('kalbAchievementsList');
  if(list)list.innerHTML=ACH.map(a=>{
    const ok=unlocked.has(a.id);
    return `<div class="kalb-ach-item ${ok?'unlocked':''}"><div class="kalb-ach-badge">${a.icon}</div><div><h4>${esc(a.name)}</h4><p>${esc(a.desc)}</p><div class="kalb-ach-locked">${ok?'Unlocked':'Locked'}</div></div></div>`;
  }).join('');
  renderProfileMini(me);
}
function renderLeaderboard(){
  const box=el('kalbLevelLeaderboard'); if(!box)return;
  const users=(usersCache&&usersCache.length?usersCache:(meCache?[meCache]:[])).slice().sort((a,b)=>(num(b.kalbXP)-num(a.kalbXP)) || (num(b.kalbStreak)-num(a.kalbStreak)));
  box.innerHTML=users.length?users.slice(0,10).map((u,i)=>{const lv=levelFromXP(num(u.kalbXP)); return `<div class="kalb-level-leader-row"><div class="kalb-level-rank">${i+1}</div><div><h4>${esc(u.name||u.displayName||String(u.email||'User').split('@')[0]||'User')}</h4><p>Streak ${num(u.kalbStreak)} · ${num(u.kalbXP)} XP</p></div><div class="kalb-level-score">Lv ${lv.level} ${esc(lv.title)}</div></div>`;}).join(''):'<div class="empty">No level data yet.</div>';
}
window.kalbRenderAchievementsSystem=async function(){
  try{const me=await syncAchievements(); renderAchievements(me); renderLeaderboard();}
  catch(e){console.error(e); status(e.message||'Could not load achievements.',true);}
};
window.kalbShowLevelLeaderboard=function(){renderLeaderboard(); const box=el('kalbLevelLeaderboard'); if(box)box.scrollIntoView({behavior:'smooth',block:'nearest'});};
window.kalbClaimDailyStreak=async function(){
  try{
    const u=auth.currentUser; if(!u)return alert('Login first.');
    const me=await getMe(); const t=today(); if(me.kalbLastStreakDate===t){status('You already claimed today. Come back tomorrow.',true); return;}
    let streak=(me.kalbLastStreakDate===yesterday())?num(me.kalbStreak)+1:1;
    const xp=num(me.kalbXP)+50; const best=Math.max(num(me.kalbBestStreak),streak); const coins=num(me.kalbCoins)+10;
    const patch={kalbXP:xp,kalbStreak:streak,kalbBestStreak:best,kalbLastStreakDate:t,kalbCoins:coins,lastLevelClaimAt:serverTimestamp()};
    const next=await syncAchievements(patch);
    renderAchievements(next); renderLeaderboard();
    try{if(typeof window.kalbRenderCoinsSystem==='function')window.kalbRenderCoinsSystem();}catch(e){}
    status(`Daily streak claimed! +50 XP and +10 Kalb Coins. Current streak: ${streak} day${streak===1?'':'s'}.`,false);
  }catch(e){console.error(e); status(e.message||'Daily streak claim failed. Check Firebase rules.',true);}
};
window.kalbAddXP=async function(amount,reason='activity',flag=''){
  try{
    const u=auth.currentUser; if(!u)return;
    const key='kalbXP_'+u.uid+'_'+reason+'_'+Math.floor(Date.now()/15000); if(localStorage.getItem(key))return; localStorage.setItem(key,'1');
    const me=await getMe(); const flags={...(me.kalbAchievementFlags||{})}; if(flag)flags[flag]=true;
    const gameXP=num(me.kalbGameXP)+(flag==='gamePlayer'?amount:0);
    const next=await syncAchievements({kalbXP:num(me.kalbXP)+Math.max(1,num(amount)),kalbAchievementFlags:flags,kalbGameXP:gameXP});
    renderAchievements(next); renderLeaderboard();
  }catch(e){console.warn('kalbAddXP failed',e)}
};
function wrapGameXP(){
  if(window.__kalbAchievementsGameWrapped)return;
  const tryWrap=()=>{
    if(typeof window.kalbAwardGameCoins==='function' && !window.kalbAwardGameCoins.__achievementsWrapped){
      const old=window.kalbAwardGameCoins;
      window.kalbAwardGameCoins=function(amount,reason){const r=old.apply(this,arguments); setTimeout(()=>window.kalbAddXP(Math.max(10,Number(amount||10)*2),reason||'game','gamePlayer'),250); return r;};
      window.kalbAwardGameCoins.__achievementsWrapped=true; window.__kalbAchievementsGameWrapped=true;
    }
  };
  tryWrap(); setTimeout(tryWrap,800); setTimeout(tryWrap,2000);
}
function wrapOpenPage(){
  if(window.openPage && !window.openPage.__achievementsWrapped){
    const old=window.openPage;
    window.openPage=function(id,navEl){const res=old.apply(this,arguments); if(id==='settingsPage'||id==='profilePage'){setTimeout(()=>window.kalbRenderAchievementsSystem&&window.kalbRenderAchievementsSystem(),250);} return res;};
    window.openPage.__achievementsWrapped=true;
  }
}
function boot(){wrapOpenPage(); wrapGameXP(); if(auth.currentUser)window.kalbRenderAchievementsSystem();}
document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
window.addEventListener('load',()=>setTimeout(boot,900));
setTimeout(boot,1800); setInterval(()=>{wrapGameXP();},3000);
onAuthStateChanged(auth,async u=>{
  if(unsubUsers){try{unsubUsers()}catch(e){} unsubUsers=null;}
  meCache=null;
  if(u){
    await window.kalbRenderAchievementsSystem();
    try{unsubUsers=onSnapshot(collection(db,'users'),snap=>{usersCache=[];snap.forEach(d=>usersCache.push({uid:d.id,...d.data()}));meCache=usersCache.find(x=>x.uid===u.uid)||meCache;renderAchievements(meCache||{});renderLeaderboard();},e=>console.warn('level leaderboard listener',e));}catch(e){console.warn(e)}
  }
});
