
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig = {apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = 'kalbhatgamer@gmail.com';
const APP_VERSION = '1.0.0';
const DEFAULT_APK_URL = 'kalb-message.apk';
let appUpdateData = {latestVersion:APP_VERSION, apkUrl:DEFAULT_APK_URL, changelog:'Latest Kalb Message update package.', forceUpdate:false};
let maintenanceData = {enabled:false,message:'We are improving Kalb Message. Please come back soon.'};
let bigToolsUsers = [];
let bigToolsPosts = [];
let bigToolsChannels = [];
let bigToolsBooted = false;
let currentUser = null;
const qsa=(s,root=document)=>Array.from(root.querySelectorAll(s));
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v||0);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0};
const isAdmin=()=>!!(auth.currentUser && String(auth.currentUser.email||'').toLowerCase()===ADMIN_EMAIL);
const today=()=>new Date().toISOString().slice(0,10);
function notice(id,msg,bad=false){const box=el(id); if(box) box.innerHTML=msg?`<div class="notice ${bad?'err':''}">${esc(msg)}</div>`:'';}
function getUserName(u){return u?.name||u?.displayName||String(u?.email||'User').split('@')[0]||'User'}
function ownedList(u,key){const x=u?.[key]; return Array.isArray(x)?x:[];}
async function getMeDoc(){const u=auth.currentUser;if(!u)return{};try{const s=await getDoc(doc(db,'users',u.uid));return s.exists()?{uid:u.uid,...s.data()}:{uid:u.uid,email:u.email||''};}catch(e){return{uid:u.uid,email:u.email||''}}}
function injectBigToolsUI(){
  if(el('kalbAppUpdateCard')) return;
  const settings=el('settingsPage');
  const admin=el('adminPage');
  const profile=el('profilePage');
  const downloadRow=el('downloadAppSettingRow');
  const coinsCard=el('kalbCoinsWalletCard');
  const appUpdateHTML=`<div class="card kalb-tool-card" id="kalbAppUpdateCard">
    <div class="kalb-tool-head"><div><h2>🚀 App Updates</h2><p class="muted">Check version, see changelog, and download the latest APK.</p></div><span class="kalb-tool-pill">Current v<span id="kalbCurrentAppVersion">${APP_VERSION}</span></span></div>
    <div class="kalb-tool-grid"><div class="kalb-tool-stat"><b id="kalbLatestVersionText">${APP_VERSION}</b><span>Latest version</span></div><div class="kalb-tool-stat"><b id="kalbUpdateStatusText">Ready</b><span>Update status</span></div></div>
    <div class="kalb-tool-row"><button class="btn small green" onclick="kalbCheckForUpdate()">Check for Update</button><a id="kalbLatestApkLink" href="${DEFAULT_APK_URL}" download="Kalb-Message.apk" style="text-decoration:none"><button class="btn small" type="button">⬇ Download Latest APK</button></a></div>
    <h3 style="margin-top:14px">Update changelog</h3><div id="kalbUpdateChangelog" class="kalb-tool-item">Latest Kalb Message update package.</div><div id="kalbUpdateStatus" class="kalb-store-status"></div>
  </div>`;
  const inviteHTML=`<div class="card kalb-tool-card" id="kalbInviteCompetitionCard">
    <div class="kalb-tool-head"><div><h2>🏆 Invite Competition</h2><p class="muted">Invite friends, earn coins, unlock milestone badges, and climb the leaderboard.</p></div><span class="kalb-tool-pill">Invites: <span id="kalbMyInviteCount">0</span></span></div>
    <div class="kalb-tool-row"><input id="kalbInviteLinkInput" readonly placeholder="Your invite link"><button class="btn small green" onclick="kalbCopyInviteLink()">Copy Invite Link</button><button class="btn small" onclick="kalbClaimInviteMilestones()">Claim Milestones</button></div>
    <div class="kalb-tool-grid"><div class="kalb-tool-stat"><b id="kalbReferralRewardText">+20</b><span>Coins per invited friend</span></div><div class="kalb-tool-stat"><b id="kalbInviteRankText">—</b><span>Your invite rank</span></div><div class="kalb-tool-stat"><b id="kalbInviteBadgesText">0</b><span>Milestone badges</span></div></div>
    <div class="kalb-lock-note">Milestones: 1 invite = Rookie Inviter, 5 invites = Pro Inviter, 10 invites = Invite Legend.</div>
    <h3 style="margin-top:14px">Top Inviters</h3><div id="kalbInviteLeaderboard" class="kalb-tool-list"><div class="empty">Invite leaderboard will appear here.</div></div><div id="kalbInviteStatus"></div>
  </div>`;
  const creatorHTML=`<div class="card kalb-tool-card" id="kalbCreatorDashboardCard">
    <div class="kalb-tool-head"><div><h2>📊 Creator Dashboard</h2><p class="muted">Stats for your posts and channels.</p></div><button class="btn small green" onclick="kalbRenderCreatorDashboard()">Refresh</button></div>
    <div class="kalb-tool-grid"><div class="kalb-tool-stat"><b id="kalbCreatorFollowers">0</b><span>Followers count</span></div><div class="kalb-tool-stat"><b id="kalbCreatorPostViews">0</b><span>Post views / reach</span></div><div class="kalb-tool-stat"><b id="kalbCreatorChannels">0</b><span>Channels</span></div><div class="kalb-tool-stat"><b id="kalbCreatorEngagement">0</b><span>Engagement</span></div></div>
    <div class="kalb-tool-grid"><div class="kalb-tool-item"><h4>🏅 Top Post</h4><p id="kalbCreatorTopPost">No post data yet.</p></div><div class="kalb-tool-item"><h4>📈 Channel Growth</h4><p id="kalbCreatorChannelGrowth">No channel data yet.</p></div></div>
    <div id="kalbCreatorChannelList" class="kalb-tool-list"></div>
  </div>`;
  const adminHTML=`<div class="card kalb-tool-card admin-nav hidden" id="kalbAdminAppControlCard">
    <div class="kalb-tool-head"><div><h3>🚀 App Update + Maintenance Control</h3><p class="muted">Admin can publish version info and turn maintenance mode on/off.</p></div></div>
    <div class="kalb-tool-grid"><div><label class="muted">Latest version</label><input id="kalbAdminLatestVersion" placeholder="1.0.1"></div><div><label class="muted">APK URL</label><input id="kalbAdminApkUrl" placeholder="kalb-message.apk"></div></div>
    <textarea id="kalbAdminChangelog" placeholder="Write update changelog..."></textarea>
    <div class="kalb-tool-row"><button class="btn small green" onclick="kalbAdminSaveAppUpdate()">Save App Update</button><button class="btn small" onclick="kalbAdminLoadAppUpdate()">Load</button></div>
    <hr style="border-color:rgba(255,255,255,.12);margin:16px 0">
    <div class="kalb-tool-row"><select id="kalbAdminMaintenanceState"><option value="off">Maintenance OFF</option><option value="on">Maintenance ON</option></select><input id="kalbAdminMaintenanceMessage" placeholder="Maintenance message"></div>
    <div class="kalb-tool-row"><button class="btn small red" onclick="kalbAdminSaveMaintenance()">Save Maintenance Mode</button><button class="btn small" onclick="kalbAdminLoadMaintenance()">Refresh Status</button></div><div id="kalbAdminAppControlStatus"></div>
  </div>`;
  if(downloadRow) downloadRow.insertAdjacentHTML('afterend', appUpdateHTML); else settings?.insertAdjacentHTML('afterbegin', appUpdateHTML);
  if(coinsCard) coinsCard.insertAdjacentHTML('afterend', inviteHTML); else settings?.insertAdjacentHTML('afterbegin', inviteHTML);
  if(profile) profile.insertAdjacentHTML('beforeend', creatorHTML); else settings?.insertAdjacentHTML('afterbegin', creatorHTML);
  if(admin) admin.insertAdjacentHTML('afterbegin', adminHTML);
}
function compareVersion(a,b){
  const pa=String(a||'0').split('.').map(x=>parseInt(x,10)||0), pb=String(b||'0').split('.').map(x=>parseInt(x,10)||0);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return -1;}return 0;
}
function renderAppUpdate(){
  const latest=appUpdateData.latestVersion||APP_VERSION, apk=appUpdateData.apkUrl||DEFAULT_APK_URL;
  if(el('kalbLatestVersionText')) el('kalbLatestVersionText').innerText=latest;
  const need=compareVersion(latest,APP_VERSION)>0;
  if(el('kalbUpdateStatusText')) el('kalbUpdateStatusText').innerText=need?'New update':'Up to date';
  if(el('kalbUpdateStatusText')) el('kalbUpdateStatusText').className=need?'kalb-tool-warn':'kalb-tool-good';
  const link=el('kalbLatestApkLink'); if(link){link.href=apk; link.setAttribute('download','Kalb-Message-'+latest+'.apk');}
  if(el('kalbUpdateChangelog')) el('kalbUpdateChangelog').innerHTML=esc(appUpdateData.changelog||'No changelog added.').replace(/\n/g,'<br>');
  if(el('kalbAdminLatestVersion')) el('kalbAdminLatestVersion').value=latest;
  if(el('kalbAdminApkUrl')) el('kalbAdminApkUrl').value=apk;
  if(el('kalbAdminChangelog')) el('kalbAdminChangelog').value=appUpdateData.changelog||'';
}
window.kalbCheckForUpdate=async function(){await loadAppUpdate(); const need=compareVersion(appUpdateData.latestVersion,APP_VERSION)>0; notice('kalbUpdateStatus',need?'New version available. Tap Download Latest APK.':'You are using the latest version.');};
window.kalbAdminLoadAppUpdate=async function(){await loadAppUpdate(); notice('kalbAdminAppControlStatus','App update data loaded.');};
window.kalbAdminSaveAppUpdate=async function(){
  if(!isAdmin())return alert('Admin only.');
  const latest=(el('kalbAdminLatestVersion')?.value||APP_VERSION).trim(); const apk=(el('kalbAdminApkUrl')?.value||DEFAULT_APK_URL).trim(); const changelog=(el('kalbAdminChangelog')?.value||'').trim();
  try{await setDoc(doc(db,'appConfig','appUpdate'),{latestVersion:latest,apkUrl:apk,changelog,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.email||''},{merge:true}); appUpdateData={latestVersion:latest,apkUrl:apk,changelog}; renderAppUpdate(); notice('kalbAdminAppControlStatus','App update saved.');}catch(e){console.error(e);notice('kalbAdminAppControlStatus',e.message||'Could not save app update. Check Firebase rules.',true)}
};
async function loadAppUpdate(){try{const s=await getDoc(doc(db,'appConfig','appUpdate')); if(s.exists())appUpdateData={...appUpdateData,...s.data()};}catch(e){console.warn('app update load failed',e)} renderAppUpdate();}
function renderMaintenance(){
  const overlay=el('kalbMaintenanceOverlay'); if(!overlay)return; const on=maintenanceData.enabled===true && !isAdmin();
  overlay.style.display=on?'flex':'none'; if(el('kalbMaintenanceOverlayMessage'))el('kalbMaintenanceOverlayMessage').innerText=maintenanceData.message||'We are improving Kalb Message. Please come back soon.';
  if(el('kalbAdminMaintenanceState'))el('kalbAdminMaintenanceState').value=maintenanceData.enabled?'on':'off'; if(el('kalbAdminMaintenanceMessage'))el('kalbAdminMaintenanceMessage').value=maintenanceData.message||'';
}
window.kalbAdminLoadMaintenance=async function(){await loadMaintenance(); notice('kalbAdminAppControlStatus','Maintenance status loaded.');};
window.kalbAdminSaveMaintenance=async function(){
  if(!isAdmin())return alert('Admin only.'); const enabled=(el('kalbAdminMaintenanceState')?.value==='on'); const message=(el('kalbAdminMaintenanceMessage')?.value||'Kalb Message is under maintenance. Please come back soon.').trim();
  try{await setDoc(doc(db,'appConfig','maintenance'),{enabled,message,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.email||''},{merge:true}); maintenanceData={enabled,message}; renderMaintenance(); notice('kalbAdminAppControlStatus',enabled?'Maintenance mode is ON.':'Maintenance mode is OFF.');}catch(e){console.error(e);notice('kalbAdminAppControlStatus',e.message||'Could not save maintenance. Check Firebase rules.',true)}
};
async function loadMaintenance(){try{const s=await getDoc(doc(db,'appConfig','maintenance')); if(s.exists())maintenanceData={...maintenanceData,...s.data()};}catch(e){console.warn('maintenance load failed',e)} renderMaintenance();}
function makeInviteLink(uid){const url=new URL(location.href); url.search=''; url.hash=''; url.searchParams.set('ref',uid||''); return url.toString();}
async function processReferral(user){
  try{
    const refUid=new URLSearchParams(location.search).get('ref')||''; if(!refUid||!user||refUid===user.uid)return;
    const key='kalbReferralSaved_'+user.uid; if(localStorage.getItem(key))return;
    const meRef=doc(db,'users',user.uid); const meSnap=await getDoc(meRef); const me=meSnap.exists()?meSnap.data():{}; if(me.referredBy)return localStorage.setItem(key,'1');
    await setDoc(meRef,{referredBy:refUid,referredAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,'users',refUid),{referralCount:increment(1),kalbCoins:increment(20),lastReferralAt:serverTimestamp()},{merge:true});
    localStorage.setItem(key,'1');
  }catch(e){console.warn('referral save failed',e)}
}
function renderInviteCompetition(){
  const u=auth.currentUser; if(!u)return; const me=bigToolsUsers.find(x=>x.uid===u.uid)||{}; const count=num(me.referralCount||me.inviteCount||0); const badges=ownedList(me,'inviteMilestoneBadges'); const ranked=bigToolsUsers.slice().sort((a,b)=>num(b.referralCount)-num(a.referralCount)); const rank=ranked.findIndex(x=>x.uid===u.uid)+1;
  if(el('kalbMyInviteCount'))el('kalbMyInviteCount').innerText=count; if(el('kalbInviteLinkInput'))el('kalbInviteLinkInput').value=makeInviteLink(u.uid); if(el('kalbInviteRankText'))el('kalbInviteRankText').innerText=rank>0?'#'+rank:'—'; if(el('kalbInviteBadgesText'))el('kalbInviteBadgesText').innerText=badges.length;
  const box=el('kalbInviteLeaderboard'); if(box){const top=ranked.filter(x=>num(x.referralCount)>0).slice(0,10); box.innerHTML=top.length?top.map((x,i)=>`<div class="kalb-tool-item"><h4>#${i+1} ${esc(getUserName(x))}</h4><p>${num(x.referralCount)} invites · ${num(x.kalbCoins)} coins</p></div>`).join(''):'<div class="empty">No invites yet. Share your link to become #1.</div>';}
}
window.kalbCopyInviteLink=function(){const input=el('kalbInviteLinkInput'); if(!input)return; input.value=makeInviteLink(auth.currentUser?.uid||''); input.select(); navigator.clipboard?.writeText(input.value).then(()=>notice('kalbInviteStatus','Invite link copied.')).catch(()=>notice('kalbInviteStatus','Copy failed. Select and copy manually.',true));};
window.kalbClaimInviteMilestones=async function(){
  const u=auth.currentUser;if(!u)return alert('Login first.'); const me=bigToolsUsers.find(x=>x.uid===u.uid)||await getMeDoc(); const count=num(me.referralCount); const owned=new Set(ownedList(me,'inviteMilestoneBadges')); const rewards=[{id:'rookie_inviter',need:1,coins:25,name:'Rookie Inviter'},{id:'pro_inviter',need:5,coins:100,name:'Pro Inviter'},{id:'invite_legend',need:10,coins:250,name:'Invite Legend'}];
  let coins=0, newBadges=[]; rewards.forEach(r=>{if(count>=r.need&&!owned.has(r.id)){coins+=r.coins; newBadges.push(r.id)}}); if(!newBadges.length)return notice('kalbInviteStatus','No invite milestone available yet.',true);
  try{await setDoc(doc(db,'users',u.uid),{kalbCoins:increment(coins),inviteMilestoneBadges:arrayUnion(...newBadges),inviteMilestoneClaimedAt:serverTimestamp()},{merge:true}); notice('kalbInviteStatus','Milestone claimed: +'+coins+' coins and '+newBadges.length+' badge(s).');}catch(e){console.error(e);notice('kalbInviteStatus',e.message||'Could not claim milestones.',true)}
};
function renderCreatorDashboard(){
  const u=auth.currentUser;if(!u)return; const uid=u.uid; const me=bigToolsUsers.find(x=>x.uid===uid)||{}; const myPosts=bigToolsPosts.filter(p=>p.uid===uid||p.authorUid===uid); const myChannels=bigToolsChannels.filter(c=>c.ownerUid===uid||c.uid===uid);
  const profileFollowers=num((me.followers||[]).length||me.followersCount||0); const channelFollowers=myChannels.reduce((n,c)=>n+num(c.followerCount||((c.followers||[]).length)),0); const likes=myPosts.reduce((n,p)=>n+num((p.likes||[]).length||p.likeCount),0); const comments=myPosts.reduce((n,p)=>n+num(p.commentsCount||((p.comments||[]).length)),0); const views=myPosts.reduce((n,p)=>n+num(p.views||p.viewCount||p.seenCount),0); const engagement=likes+comments+channelFollowers+myChannels.reduce((n,c)=>n+num(c.postCount),0); const reach=views || (likes+comments);
  if(el('kalbCreatorFollowers'))el('kalbCreatorFollowers').innerText=profileFollowers+channelFollowers; if(el('kalbCreatorPostViews'))el('kalbCreatorPostViews').innerText=reach; if(el('kalbCreatorChannels'))el('kalbCreatorChannels').innerText=myChannels.length; if(el('kalbCreatorEngagement'))el('kalbCreatorEngagement').innerText=engagement;
  const top=myPosts.slice().sort((a,b)=>(num((b.likes||[]).length||b.likeCount)+num(b.commentsCount))-(num((a.likes||[]).length||a.likeCount)+num(a.commentsCount)))[0]; if(el('kalbCreatorTopPost'))el('kalbCreatorTopPost').innerText=top?(String(top.text||top.caption||'Post').slice(0,140)+' · '+(num((top.likes||[]).length||top.likeCount))+' likes · '+num(top.commentsCount)+' comments'):'No post data yet.';
  const topChannel=myChannels.slice().sort((a,b)=>num(b.followerCount)-num(a.followerCount))[0]; if(el('kalbCreatorChannelGrowth'))el('kalbCreatorChannelGrowth').innerText=topChannel?`${topChannel.name||'Channel'} has ${num(topChannel.followerCount||((topChannel.followers||[]).length))} followers and ${num(topChannel.postCount)} posts.`:'Create a channel to start tracking growth.';
  const list=el('kalbCreatorChannelList'); if(list)list.innerHTML=myChannels.length?myChannels.map(c=>`<div class="kalb-tool-item"><h4>📢 ${esc(c.name||'Channel')}</h4><p>${num(c.followerCount||((c.followers||[]).length))} followers · ${num(c.postCount)} posts · ${esc(c.category||'General')}</p></div>`).join(''):'<div class="empty">No creator channels yet.</div>';
}
window.kalbRenderCreatorDashboard=renderCreatorDashboard;
function startBigToolsListeners(){
  try{onSnapshot(collection(db,'users'),snap=>{bigToolsUsers=[];snap.forEach(d=>bigToolsUsers.push({uid:d.id,...d.data()}));renderInviteCompetition();renderCreatorDashboard();},e=>console.warn('big users listener',e));}catch(e){console.warn(e)}
  try{onSnapshot(collection(db,'posts'),snap=>{bigToolsPosts=[];snap.forEach(d=>bigToolsPosts.push({id:d.id,...d.data()}));renderCreatorDashboard();},e=>console.warn('creator posts listener',e));}catch(e){console.warn(e)}
  try{onSnapshot(collection(db,'channels'),snap=>{bigToolsChannels=[];snap.forEach(d=>bigToolsChannels.push({id:d.id,...d.data()}));renderCreatorDashboard();},e=>console.warn('creator channels listener',e));}catch(e){console.warn(e)}
  try{onSnapshot(doc(db,'appConfig','appUpdate'),s=>{if(s.exists())appUpdateData={...appUpdateData,...s.data()};renderAppUpdate();},e=>console.warn('app update listener',e));}catch(e){console.warn(e)}
  try{onSnapshot(doc(db,'appConfig','maintenance'),s=>{if(s.exists())maintenanceData={...maintenanceData,...s.data()};renderMaintenance();},e=>console.warn('maintenance listener',e));}catch(e){console.warn(e)}
}
function exposeAdminCards(){qsa('.admin-nav').forEach(n=>n.classList.toggle('hidden',!isAdmin()));}
function bootBigTools(){if(bigToolsBooted)return; bigToolsBooted=true; injectBigToolsUI(); renderAppUpdate(); renderMaintenance(); exposeAdminCards(); startBigToolsListeners(); setTimeout(()=>{renderInviteCompetition();renderCreatorDashboard();},900);}
function wrapOpenPage(){if(window.openPage && !window.openPage.__bigToolsWrapped){const old=window.openPage; window.openPage=function(id,nav){const r=old.apply(this,arguments); setTimeout(()=>{if(id==='settingsPage'||id==='profilePage'||id==='adminPage'){injectBigToolsUI();renderAppUpdate();renderInviteCompetition();renderCreatorDashboard();renderMaintenance();exposeAdminCards();}},150); return r;}; window.openPage.__bigToolsWrapped=true;}}
document.addEventListener('DOMContentLoaded',()=>{injectBigToolsUI();wrapOpenPage();setTimeout(()=>{wrapOpenPage();renderAppUpdate();renderMaintenance();},600);});
window.addEventListener('load',()=>setTimeout(()=>{injectBigToolsUI();wrapOpenPage();renderAppUpdate();renderMaintenance();},800));
onAuthStateChanged(auth,async user=>{currentUser=user; injectBigToolsUI(); exposeAdminCards(); renderMaintenance(); if(user){await processReferral(user); bootBigTools(); await loadAppUpdate(); await loadMaintenance(); renderInviteCompetition(); renderCreatorDashboard();} });
setTimeout(()=>{injectBigToolsUI();wrapOpenPage(); if(auth.currentUser)bootBigTools();},1800);
