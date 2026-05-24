
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

const REWARD_NAMES={
  gold_frame:'Golden Profile Frame', name_glow:'Name Glow', gamer_badge:'Gamer Badge', gaming_badge:'Gaming Reward Badge',
  vip_bubble:'VIP Chat Bubble', vip_chat_bubble:'VIP Chat Bubble', amethyst_theme:'Amethyst Theme Pack', creator_boost:'Creator Boost'
};
const BADGE_LOCKS={
  '🎮 Gamer':['gamer_badge','gaming_badge'],
  '⭐ Creator':['creator_boost'],
  '🚀 Pro':['creator_boost']
};
const BANNER_LOCKS={
  'gold-fire':['gold_frame']
};
const THEME_LOCKS={
  anime:['amethyst_theme'],
  midnight:['amethyst_theme'],
  gaming:['gamer_badge','gaming_badge'],
  fire:['creator_boost']
};
const themeClasses=Object.keys(THEME_LOCKS).map(id=>'kalb-market-'+id);

function storageKey(){return 'kalbOwnedRewardsCache_'+(auth.currentUser?.uid||'guest');}
function readLS(){try{return JSON.parse(localStorage.getItem(storageKey())||'[]')}catch(e){return []}}
function writeLS(list){try{localStorage.setItem(storageKey(),JSON.stringify(Array.from(new Set(list||[]))))}catch(e){}}
function ownList(){
  const fromWin=Array.isArray(window.currentUserProfile?.ownedRewards)?window.currentUserProfile.ownedRewards:[];
  const fromMe=Array.isArray(window.currentMe?.ownedRewards)?window.currentMe.ownedRewards:[];
  const fromCache=Array.isArray(window.__kalbOwnedRewardsCache)?window.__kalbOwnedRewardsCache:[];
  return Array.from(new Set([...readLS(),...fromCache,...fromWin,...fromMe]));
}
function hasAny(ids){const set=new Set(ownList()); return (ids||[]).some(id=>set.has(id));}
function missingName(ids){return (ids||[]).map(id=>REWARD_NAMES[id]||id).join(' / ');}
function showBuyFirst(text){
  const msg=text||'Buy first from Settings → Kalb Coins Wallet.';
  const st=document.getElementById('profileUpgradeStatus')||document.getElementById('kalbThemeMarketStatus')||document.getElementById('kalbCoinsStatus');
  if(st){ st.innerHTML='<span class="kalb-buyfirst-chip">🔒 '+esc(msg)+'</span>'; }
  alert(msg);
}
async function refreshOwnedRewards(){
  const u=auth.currentUser; if(!u)return [];
  try{
    const snap=await getDoc(doc(db,'users',u.uid));
    const data=snap.exists()?snap.data():{};
    const list=Array.isArray(data.ownedRewards)?data.ownedRewards:[];
    window.__kalbOwnedRewardsCache=list;
    if(!window.currentUserProfile)window.currentUserProfile={};
    window.currentUserProfile={...(window.currentUserProfile||{}),ownedRewards:list,kalbCoins:data.kalbCoins??window.currentUserProfile?.kalbCoins};
    writeLS(list);
    decorateRewardLocks();
    enforceActiveMarketplaceTheme();
    return list;
  }catch(e){console.warn('Reward ownership load failed',e); return ownList();}
}

function premiumBadgeText(text){return String(text||'').replace(/\s*\(Buy first\)\s*$/,'').trim();}
function badgeNeed(badge){return BADGE_LOCKS[premiumBadgeText(badge)]||null;}
function userHasReward(u,ids){const list=Array.isArray(u?.ownedRewards)?u.ownedRewards:[]; return (ids||[]).some(id=>list.includes(id));}
function filterLockedBadgesForUser(u){
  const badges=Array.isArray(u?.badges)?u.badges:[];
  return badges.filter(b=>{const need=badgeNeed(b); return !need || userHasReward(u,need);});
}
function decorateRewardLocks(){
  document.querySelectorAll('.badge-chip').forEach(btn=>{
    const need=badgeNeed(btn.textContent||'');
    btn.classList.toggle('kalb-locked-reward', !!(need && !hasAny(need)));
    if(need && !hasAny(need)) btn.title='Buy first: '+missingName(need);
  });
  document.querySelectorAll('.banner-dot').forEach(dot=>{
    const click=dot.getAttribute('onclick')||'';
    const isGold=click.includes('gold-fire');
    dot.classList.toggle('kalb-locked-reward', !!(isGold && !hasAny(BANNER_LOCKS['gold-fire'])));
    if(isGold && !hasAny(BANNER_LOCKS['gold-fire'])) dot.title='Buy first: Golden Profile Frame';
  });
  decorateThemeMarketplaceButtons();
}
function decorateThemeMarketplaceButtons(){
  const box=document.getElementById('kalbThemeMarketplaceList'); if(!box)return;
  box.querySelectorAll('.kalb-theme-card').forEach(card=>{
    const cls=Array.from(card.classList).find(c=>c.startsWith('kalb-theme-'))||'';
    const id=cls.replace('kalb-theme-','');
    const need=THEME_LOCKS[id];
    if(need && !hasAny(need)){
      card.style.opacity='.82';
      const actions=card.querySelector('.actions');
      if(actions && !actions.querySelector('.kalb-buyfirst-chip')) actions.insertAdjacentHTML('beforeend','<span class="kalb-buyfirst-chip">🔒 Buy first</span>');
    }
  });
}
function enforceActiveMarketplaceTheme(){
  const active=localStorage.getItem('kalbActiveMarketplaceTheme')||'';
  const need=THEME_LOCKS[active];
  if(need && !hasAny(need)){
    Object.keys(THEME_LOCKS).forEach(id=>document.body.classList.remove('kalb-market-'+id));
    localStorage.removeItem('kalbActiveMarketplaceTheme');
    const st=document.getElementById('kalbThemeMarketStatus');
    if(st)st.textContent='Premium theme locked. Buy first from Kalb Coins Wallet.';
  }
}

function patchFunctions(){
  if(window.__kalbRewardGatePatched)return;
  window.__kalbRewardGatePatched=true;

  const oldToggle=window.toggleProfileBadge;
  if(typeof oldToggle==='function'){
    window.toggleProfileBadge=function(badge){
      const clean=premiumBadgeText(badge);
      const need=BADGE_LOCKS[clean];
      const btn=Array.from(document.querySelectorAll('.badge-chip')).find(b=>premiumBadgeText(b.textContent)===clean);
      const removing=btn?.classList.contains('active');
      if(need && !removing && !hasAny(need)) return showBuyFirst('Buy first: '+missingName(need)+'.');
      return oldToggle.apply(this,arguments);
    };
  }

  const oldBanner=window.setProfileBannerColor;
  if(typeof oldBanner==='function'){
    window.setProfileBannerColor=function(color){
      const need=BANNER_LOCKS[color];
      if(need && !hasAny(need)) return showBuyFirst('Buy first: '+missingName(need)+'.');
      return oldBanner.apply(this,arguments);
    };
  }

  const oldSave=window.saveProfileAboutUpgrade;
  if(typeof oldSave==='function'){
    window.saveProfileAboutUpgrade=function(){
      const activeBadges=Array.from(document.querySelectorAll('.badge-chip.active')).map(b=>premiumBadgeText(b.textContent));
      for(const b of activeBadges){ const need=BADGE_LOCKS[b]; if(need && !hasAny(need)) return showBuyFirst('Buy first: '+missingName(need)+'.'); }
      const goldSelected=(window.currentUserProfile?.bannerColor==='gold-fire');
      if(goldSelected && !hasAny(BANNER_LOCKS['gold-fire'])) return showBuyFirst('Buy first: Golden Profile Frame.');
      return oldSave.apply(this,arguments);
    };
  }

  const oldBadgesHtml=window.profileBadgesHtml;
  if(typeof oldBadgesHtml==='function'){
    window.profileBadgesHtml=function(u){
      const copy={...(u||{}),badges:filterLockedBadgesForUser(u||{})};
      return oldBadgesHtml(copy);
    };
  }

  const oldEnhance=window.enhanceProfileViewUpgrade;
  if(typeof oldEnhance==='function'){
    window.enhanceProfileViewUpgrade=function(u,canView,posts){
      const clean={...(u||{}),badges:filterLockedBadgesForUser(u||{})};
      const r=oldEnhance.call(this,clean,canView,posts);
      const name=document.getElementById('viewProfileName');
      const card=document.querySelector('#viewProfilePage .profile-view-card');
      if(name){
        const owned=Array.isArray(u?.ownedRewards)?u.ownedRewards:[];
        name.classList.toggle('profile-coin-glow', owned.includes('name_glow'));
        card?.classList.toggle('kalb-reward-owned', owned.includes('gold_frame'));
      }
      return r;
    };
  }

  ['kalbInstallMarketplaceTheme','kalbApplyMarketplaceTheme'].forEach(fn=>{
    const old=window[fn];
    if(typeof old==='function'){
      window[fn]=function(id){
        const need=THEME_LOCKS[id];
        if(need && !hasAny(need)) return showBuyFirst('Buy first: '+missingName(need)+'.');
        return old.apply(this,arguments);
      };
    }
  });

  const oldBuy=window.kalbBuyReward;
  if(typeof oldBuy==='function'){
    window.kalbBuyReward=async function(id){
      const r=await oldBuy.apply(this,arguments);
      setTimeout(refreshOwnedRewards,500);
      return r;
    };
  }

  const oldRenderStore=window.kalbRenderCoinsSystem;
  if(typeof oldRenderStore==='function'){
    window.kalbRenderCoinsSystem=function(){
      const r=oldRenderStore.apply(this,arguments);
      setTimeout(()=>{refreshOwnedRewards();decorateRewardLocks();},350);
      return r;
    };
  }
}

function bootGate(){patchFunctions();decorateRewardLocks();enforceActiveMarketplaceTheme();setTimeout(decorateRewardLocks,700);setTimeout(decorateRewardLocks,1800);}
document.addEventListener('DOMContentLoaded',bootGate);
window.addEventListener('load',bootGate);
setTimeout(bootGate,1200);
setInterval(()=>{decorateRewardLocks();enforceActiveMarketplaceTheme();},3000);
onAuthStateChanged(auth,u=>{window.__kalbOwnedRewardsCache=[]; if(u)refreshOwnedRewards();});
