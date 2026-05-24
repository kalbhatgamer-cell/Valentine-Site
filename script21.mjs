
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function uidOf(u){return String(u?.uid||u?.id||u?.userId||u?.docId||u?.__docId||"");}
function baseId(uid,salt=""){
  let h=2166136261>>>0, str=String(uid||"")+String(salt||"");
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return "KLB-"+String(h%1000000).padStart(6,"0");
}
function kalbIdOf(u){return String(u?.kalbId||u?.profileId||u?.publicId||u?.shortId||baseId(uidOf(u))).toUpperCase();}
function maskEmail(email){
  const raw=String(email||"");
  return raw.replace(/([A-Za-z0-9._%+-]{1,})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,(m,local,domain)=>{
    const left=local.length<=2?local[0]:(local.slice(0,3));
    return left+"***@"+domain;
  });
}
window.kalbMaskEmail=maskEmail;
function usersCached(){return Array.isArray(window.allUsers)?window.allUsers:[];}
async function loadAllUsersSafe(){
  try{
    const snap=await getDocs(collection(db,"users"));
    const arr=[]; snap.forEach(d=>arr.push({uid:d.id,id:d.id,__docId:d.id,...d.data()}));
    window.allUsers=arr;
    return arr;
  }catch(e){return usersCached();}
}
async function getUserSafe(uid){
  if(!uid)return null;
  let found=usersCached().find(u=>uidOf(u)===uid);
  if(found)return found;
  try{const s=await getDoc(doc(db,"users",uid)); if(s.exists())return {uid:s.id,id:s.id,...s.data()};}catch(e){}
  return null;
}
async function findUserByProfileKey(key){
  const k=String(key||"").trim().toLowerCase();
  if(!k)return null;
  const users=await loadAllUsersSafe();
  return users.find(u=>[uidOf(u),kalbIdOf(u),u.email,u.username].filter(Boolean).some(x=>String(x).trim().toLowerCase()===k))||null;
}
function profileUrlFor(u){
  const kid=kalbIdOf(u);
  return `${location.origin}${location.pathname}?profile=${encodeURIComponent(kid)}`;
}
function inviteUrlFor(u){
  const kid=kalbIdOf(u);
  return `${location.origin}${location.pathname}?ref=${encodeURIComponent(kid)}`;
}
function referralCountFor(u){
  const uid=uidOf(u), kid=kalbIdOf(u);
  return usersCached().filter(x=>String(x.referredByUid||"")===uid || String(x.referrerUid||"")===uid || String(x.referredByKalbId||"").toUpperCase()===kid || String(x.referralId||"").toUpperCase()===kid).length;
}
function loadQrLib(){
  return new Promise(resolve=>{
    if(window.QRious)return resolve(true);
    const old=document.getElementById("kalbQriousLib");
    if(old){old.addEventListener("load",()=>resolve(true),{once:true}); old.addEventListener("error",()=>resolve(false),{once:true}); return;}
    const s=document.createElement("script");
    s.id="kalbQriousLib";
    s.src="https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js";
    s.onload=()=>resolve(true);
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
}
async function renderQr(canvasId,value){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const ok=await loadQrLib();
  if(ok && window.QRious){
    new window.QRious({element:canvas,value,size:132,level:"M"});
  }else{
    const ctx=canvas.getContext("2d");
    canvas.width=132; canvas.height=132;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,132,132);
    ctx.fillStyle="#0f172a"; ctx.font="12px Arial"; ctx.textAlign="center";
    ctx.fillText("QR unavailable",66,60); ctx.fillText("Copy link",66,78);
  }
}
async function copyText(text,label="Copied"){
  try{await navigator.clipboard.writeText(text); alert(label);}catch(e){prompt("Copy this:",text);}
}
window.copyKalbIdFinal=function(kid){copyText(kid,"Kalb ID copied.");};
window.copyProfileLinkFinal=function(url){copyText(url,"Profile link copied.");};
window.copyInviteLinkFinal=function(url){copyText(url,"Invite link copied.");};
window.shareProfileFinal=async function(name,url){
  try{
    if(navigator.share){await navigator.share({title:`${name} on Kalb Message`,text:`Open my Kalb Message profile`,url});}
    else await copyText(url,"Profile link copied.");
  }catch(e){}
};
window.shareInviteFinal=async function(name,url){
  try{
    if(navigator.share){await navigator.share({title:"Join Kalb Message",text:`Join Kalb Message from ${name}'s invite`,url});}
    else await copyText(url,"Invite link copied.");
  }catch(e){}
};
function shareCardHtml(u,own=false){
  const name=u?.name||u?.displayName||u?.username||"User";
  const kid=kalbIdOf(u);
  const pUrl=profileUrlFor(u);
  const iUrl=inviteUrlFor(u);
  const refs=referralCountFor(u);
  const qrId=`kalbQr_${kid.replace(/[^a-zA-Z0-9]/g,"")}_${own?"own":"view"}`;
  setTimeout(()=>renderQr(qrId,pUrl),100);
  return `<div class="kalb-share-card" id="${own?'kalbOwnShareCard':'kalbViewShareCard'}">
    <h3>Profile QR & Share</h3>
    <p class="muted">Share this profile safely. Email is hidden for privacy.</p>
    <div class="kalb-share-grid">
      <div class="kalb-qr-box"><canvas id="${qrId}" width="132" height="132"></canvas></div>
      <div class="kalb-share-info">
        <p><b>${esc(name)}</b></p>
        <p class="muted">Kalb ID: <b>${esc(kid)}</b></p>
        <div class="kalb-share-link">${esc(pUrl)}</div>
        <div class="kalb-share-actions">
          <button class="btn small" onclick='copyKalbIdFinal("${esc(kid)}")'>Copy Kalb ID</button>
          <button class="btn small green" onclick='copyProfileLinkFinal("${esc(pUrl)}")'>Copy Profile Link</button>
          <button class="btn small" onclick='shareProfileFinal("${esc(name)}","${esc(pUrl)}")'>Share Profile</button>
          ${own?`<button class="btn small" onclick='shareInviteFinal("${esc(name)}","${esc(iUrl)}")'>Invite Friends</button>`:`<button class="btn small" onclick='copyInviteLinkFinal("${esc(iUrl)}")'>Copy Invite</button>`}
        </div>
      </div>
    </div>
    <div class="kalb-referral-row">
      <div class="kalb-referral-stat"><b>${esc(kid)}</b><span>Kalb ID</span></div>
      <div class="kalb-referral-stat"><b>${refs}</b><span>Referrals</span></div>
      <div class="kalb-referral-stat"><b>${own?'Your Invite':'Invite Link'}</b><span>${own?'Share to friends':'Available'}</span></div>
    </div>
  </div>`;
}
function insertOwnShareCard(u){
  const holder=document.querySelector("#profilePage .profile-upgrade-tools") || document.querySelector("#profilePage .card");
  if(!holder||!u)return;
  document.getElementById("kalbOwnShareCard")?.remove();
  holder.insertAdjacentHTML("beforeend",shareCardHtml(u,true));
}
async function insertViewShareCard(u){
  if(!u)return;
  const bio=document.getElementById("viewProfileBio") || document.getElementById("viewProfileLastSeen") || document.getElementById("viewProfileEmail");
  const card=document.querySelector("#viewProfilePage .card");
  if(!card)return;
  document.getElementById("kalbViewShareCard")?.remove();
  (bio||card).insertAdjacentHTML(bio?"afterend":"beforeend",shareCardHtml(u,false));
}
function applyEmailPrivacyToProfile(u){
  const email=String(u?.email||"");
  const masked=maskEmail(email);
  const v=document.getElementById("viewProfileEmail");
  if(v && email){v.textContent=masked; v.classList.add("kalb-masked-email");}
  const p=document.getElementById("profileEmail");
  if(p && p.textContent){p.textContent=maskEmail(p.textContent); p.classList.add("kalb-masked-email");}
  document.querySelectorAll(".profile-about-item").forEach(item=>{
    const label=(item.querySelector("small")?.textContent||"").toLowerCase();
    if(label.includes("email")){const b=item.querySelector("b"); if(b)b.textContent=maskEmail(b.textContent);}
  });
}
const originalProfileAboutHtml=window.profileAboutHtml;
if(typeof originalProfileAboutHtml==="function"){
  window.profileAboutHtml=function(u){
    const clone={...(u||{})};
    if(clone.email)clone.email=maskEmail(clone.email);
    const html=originalProfileAboutHtml(clone);
    return html.replace(/([A-Za-z0-9._%+-]{1,})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,(m)=>maskEmail(m));
  };
}
function scheduleDomMask(){
  clearTimeout(window.__kalbEmailMaskTimer);
  window.__kalbEmailMaskTimer=setTimeout(()=>maskVisibleEmails(document.body),120);
}
function maskVisibleEmails(root){
  if(!root)return;
  const skip=new Set(["SCRIPT","STYLE","TEXTAREA","INPUT","SELECT","OPTION","CANVAS"]);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p || skip.has(p.tagName) || p.closest("script,style,textarea,input,select,option"))return NodeFilter.FILTER_REJECT;
    return /[A-Za-z0-9._%+-]{1,}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(node.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
  }});
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{n.nodeValue=maskEmail(n.nodeValue);});
}
async function currentUserProfileSafe(){
  const me=auth.currentUser||window.currentUser;
  if(!me)return null;
  await loadAllUsersSafe();
  return usersCached().find(u=>uidOf(u)===me.uid) || await getUserSafe(me.uid) || {uid:me.uid,email:me.email,displayName:me.displayName};
}
async function refreshOwnShare(){
  const u=await currentUserProfileSafe();
  if(u){insertOwnShareCard(u); applyEmailPrivacyToProfile(u);}
  scheduleDomMask();
}
async function refreshViewedShare(uid){
  let u=uid?await getUserSafe(uid):(window.viewedProfileUser||null);
  if(!u){
    const kidText=(document.getElementById("visibleKalbIdLine")?.textContent||"").replace(/^ID:\s*/i,"").trim();
    if(kidText)u=await findUserByProfileKey(kidText);
  }
  if(u){window.__kalbLastShareProfileUid=uidOf(u); await loadAllUsersSafe(); insertViewShareCard(u); applyEmailPrivacyToProfile(u);}
  scheduleDomMask();
}
function wrapFunctions(){
  if(typeof window.viewUserProfile==="function" && !window.viewUserProfile.__kalbShareWrapped){
    const old=window.viewUserProfile;
    window.viewUserProfile=async function(uid){
      const target=await findUserByProfileKey(uid) || (uid?{uid}:null);
      const realUid=target?uidOf(target):uid;
      const r=await old.call(this,realUid);
      setTimeout(()=>refreshViewedShare(realUid),350);
      setTimeout(()=>refreshViewedShare(realUid),1000);
      return r;
    };
    window.viewUserProfile.__kalbShareWrapped=true;
  }
  if(typeof window.openPage==="function" && !window.openPage.__kalbShareWrapped){
    const oldOpen=window.openPage;
    window.openPage=function(id,nav){
      const r=oldOpen.apply(this,arguments);
      if(id==="profilePage")setTimeout(refreshOwnShare,250);
      if(id==="viewProfilePage")setTimeout(()=>refreshViewedShare(window.__kalbLastShareProfileUid),250);
      setTimeout(scheduleDomMask,180);
      return r;
    };
    window.openPage.__kalbShareWrapped=true;
  }
}
async function saveReferralIfNeeded(){
  const me=auth.currentUser||window.currentUser;
  const refKey=new URLSearchParams(location.search).get("ref") || localStorage.getItem("kalbPendingReferral");
  if(!refKey)return;
  localStorage.setItem("kalbPendingReferral",refKey);
  if(!me)return;
  const refUser=await findUserByProfileKey(refKey);
  const refUid=uidOf(refUser||{});
  if(!refUid || refUid===me.uid)return;
  const mine=await getUserSafe(me.uid);
  if(mine && (mine.referredByUid || mine.referrerUid || mine.referredByKalbId))return;
  try{
    await setDoc(doc(db,"users",me.uid),{referredByUid:refUid,referredByKalbId:kalbIdOf(refUser),referralJoinedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    localStorage.removeItem("kalbPendingReferral");
  }catch(e){console.warn("Referral save failed",e);}
}
async function openDeepProfileIfNeeded(){
  const key=new URLSearchParams(location.search).get("profile");
  if(!key || !auth.currentUser)return;
  const u=await findUserByProfileKey(key);
  if(u && typeof window.viewUserProfile==="function")setTimeout(()=>window.viewUserProfile(uidOf(u)),700);
}
function boot(){
  wrapFunctions();
  scheduleDomMask();
  refreshOwnShare();
  saveReferralIfNeeded();
  openDeepProfileIfNeeded();
}
document.addEventListener("DOMContentLoaded",boot);
setTimeout(boot,800); setTimeout(boot,2200); setInterval(()=>{wrapFunctions();scheduleDomMask();},3500);
const mo=new MutationObserver(()=>scheduleDomMask());
try{mo.observe(document.body,{childList:true,subtree:true,characterData:true});}catch(e){}
onAuthStateChanged(auth,()=>{setTimeout(boot,900); setTimeout(openDeepProfileIfNeeded,1600);});
