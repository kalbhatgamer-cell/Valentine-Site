
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",
  authDomain: "kalb-message.firebaseapp.com",
  projectId: "kalb-message",
  storageBucket: "kalb-message.firebasestorage.app",
  messagingSenderId: "139873273901",
  appId: "1:139873273901:web:c7c079d385daeb3401d0a4",
  measurementId: "G-C9S0K1SG0D"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const authCommunity = getAuth(app);
const dbCommunity = getFirestore(app);
let communityUser = authCommunity.currentUser || null;
let kalbChannelsCache = [];
let kalbGroupsCache = [];
let kalbOpenChannelId = '';
let unsubChannels = null;
let unsubChannelPosts = null;

function byId(id){ return document.getElementById(id); }
function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function status(msg, bad){ const box=byId('kalbCommunityStatus'); if(box) box.innerHTML = msg ? '<div class="notice '+(bad?'err':'')+'">'+esc(msg)+'</div>' : ''; }
function timeText(ts){
  try{ const d = ts && ts.seconds ? new Date(ts.seconds*1000) : (ts ? new Date(ts) : null); return d ? d.toLocaleString() : ''; }catch(e){ return ''; }
}
function currentUid(){ return communityUser && communityUser.uid; }
async function getMeName(){
  try{ const u=communityUser; if(!u) return 'User'; const s=await getDoc(doc(dbCommunity,'users',u.uid)); const d=s.exists()?s.data():{}; return d.name || u.displayName || u.email || 'User'; }catch(e){ return (communityUser&&communityUser.displayName)||'User'; }
}

window.kalbShowCommunityTab = function(tab){
  const isGroups = tab === 'groups';
  byId('kalbChannelsPanel')?.classList.toggle('hidden', isGroups);
  byId('kalbPublicGroupsPanel')?.classList.toggle('hidden', !isGroups);
  byId('communityChannelsTabBtn')?.classList.toggle('active', !isGroups);
  byId('communityGroupsTabBtn')?.classList.toggle('active', isGroups);
  status('');
  if(isGroups) window.kalbLoadPublicGroups(); else window.kalbRenderChannels();
};
window.kalbToggleCreateChannel = function(){ byId('kalbCreateChannelBox')?.classList.toggle('hidden'); };
window.kalbToggleCreatePublicGroup = function(){ byId('kalbCreatePublicGroupBox')?.classList.toggle('hidden'); };

function startChannelsListener(){
  if(unsubChannels) unsubChannels();
  try{
    unsubChannels = onSnapshot(query(collection(dbCommunity,'channels'), orderBy('updatedAt','desc')), snap => {
      kalbChannelsCache=[];
      snap.forEach(d=>kalbChannelsCache.push({id:d.id,...d.data()}));
      window.kalbRenderChannels();
    }, err => { console.warn(err); status('Channels could not load. Check Firestore rules for channels.', true); });
  }catch(e){ console.warn(e); status('Channels could not load.', true); }
}

window.kalbCreateChannel = async function(){
  if(!currentUid()) return alert('Login first.');
  const name=(byId('kalbChannelName')?.value||'').trim();
  const desc=(byId('kalbChannelDesc')?.value||'').trim();
  const category=byId('kalbChannelCategory')?.value||'General';
  if(!name) return alert('Enter channel name.');
  const ownerName=await getMeName();
  try{
    await addDoc(collection(dbCommunity,'channels'),{
      name, desc, category, isPublic:true,
      ownerUid:currentUid(), ownerName,
      followers:[currentUid()], followerCount:1, postCount:0,
      lastPost:'', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    });
    if(byId('kalbChannelName')) byId('kalbChannelName').value='';
    if(byId('kalbChannelDesc')) byId('kalbChannelDesc').value='';
    byId('kalbCreateChannelBox')?.classList.add('hidden');
    status('Channel created.');
  }catch(e){ console.warn(e); alert('Channel create failed. Check Firebase rules.'); }
};

window.kalbRenderChannels = function(){
  const box=byId('kalbChannelsList'); if(!box) return;
  const q=(byId('kalbChannelSearch')?.value||'').toLowerCase().trim();
  let list=kalbChannelsCache.filter(c=>!q || ((c.name||'')+' '+(c.desc||'')+' '+(c.category||'')).toLowerCase().includes(q));
  if(!list.length){ box.innerHTML='<div class="community-empty">No channels found. Create the first channel.</div>'; return; }
  box.innerHTML=list.map(c=>{
    const followed=(c.followers||[]).includes(currentUid());
    const owner=c.ownerUid===currentUid();
    return `<div class="community-card">
      <h3>📢 ${esc(c.name||'Channel')}</h3>
      <p>${esc(c.desc||'No description')}</p>
      <div class="community-meta"><span class="community-chip">${esc(c.category||'General')}</span><span class="community-chip">${Number(c.followerCount||((c.followers||[]).length)||0)} followers</span><span class="community-chip">${Number(c.postCount||0)} posts</span>${owner?'<span class="community-chip">Owner</span>':''}</div>
      <p class="muted">${esc(c.lastPost||'No announcement yet')}</p>
      <div class="community-actions"><button class="btn small" onclick="kalbOpenChannel('${c.id}')">Open</button>${followed?`<button class="btn small red" onclick="kalbUnfollowChannel('${c.id}')">Unfollow</button>`:`<button class="btn small green" onclick="kalbFollowChannel('${c.id}')">Follow</button>`}</div>
    </div>`;
  }).join('');
};

window.kalbFollowChannel = async function(id){
  if(!currentUid()) return alert('Login first.');
  try{ await updateDoc(doc(dbCommunity,'channels',id),{followers:arrayUnion(currentUid()), followerCount:increment(1), updatedAt:serverTimestamp()}); }
  catch(e){ console.warn(e); alert('Follow failed. Check rules.'); }
};
window.kalbUnfollowChannel = async function(id){
  if(!currentUid()) return alert('Login first.');
  try{ await updateDoc(doc(dbCommunity,'channels',id),{followers:arrayRemove(currentUid()), followerCount:increment(-1), updatedAt:serverTimestamp()}); }
  catch(e){ console.warn(e); alert('Unfollow failed. Check rules.'); }
};

window.kalbOpenChannel = async function(id){
  kalbOpenChannelId=id;
  const c=kalbChannelsCache.find(x=>x.id===id);
  const detail=byId('kalbChannelDetail'); if(!detail || !c) return;
  const owner=c.ownerUid===currentUid();
  const followed=(c.followers||[]).includes(currentUid());
  detail.classList.remove('hidden');
  detail.innerHTML=`<div class="community-actions"><button class="btn small" onclick="kalbCloseChannelDetail()">Close</button>${followed?`<button class="btn small red" onclick="kalbUnfollowChannel('${id}')">Unfollow</button>`:`<button class="btn small green" onclick="kalbFollowChannel('${id}')">Follow</button>`}</div>
    <h2>📢 ${esc(c.name||'Channel')}</h2><p class="muted">${esc(c.desc||'')}</p>
    ${owner?`<textarea id="kalbChannelPostText" placeholder="Write channel announcement..."></textarea><button class="btn full green" onclick="kalbSendChannelPost('${id}')">Send Announcement</button>`:'<p class="muted">Follow this channel to get updates.</p>'}
    <div id="kalbChannelPostsBox" style="margin-top:12px"><div class="community-empty">Loading posts...</div></div>`;
  loadChannelPosts(id);
};
window.kalbCloseChannelDetail = function(){ byId('kalbChannelDetail')?.classList.add('hidden'); if(unsubChannelPosts) unsubChannelPosts(); };

function loadChannelPosts(id){
  const box=byId('kalbChannelPostsBox'); if(!box) return;
  if(unsubChannelPosts) unsubChannelPosts();
  try{
    unsubChannelPosts = onSnapshot(query(collection(dbCommunity,'channels',id,'posts'), orderBy('createdAt','desc')), snap => {
      let posts=[]; snap.forEach(d=>posts.push({id:d.id,...d.data()}));
      if(!posts.length){ box.innerHTML='<div class="community-empty">No channel posts yet.</div>'; return; }
      box.innerHTML=posts.map(p=>`<div class="channel-post"><b>${esc(p.authorName||'Channel')}</b><p>${esc(p.text||'')}</p><div class="muted">${esc(timeText(p.createdAt))}</div></div>`).join('');
    }, e=>{ console.warn(e); box.innerHTML='<div class="community-empty">Posts could not load.</div>'; });
  }catch(e){ console.warn(e); box.innerHTML='<div class="community-empty">Posts could not load.</div>'; }
}
window.kalbSendChannelPost = async function(id){
  const c=kalbChannelsCache.find(x=>x.id===id);
  if(!c || c.ownerUid!==currentUid()) return alert('Only channel owner can post.');
  const text=(byId('kalbChannelPostText')?.value||'').trim();
  if(!text) return alert('Write announcement first.');
  try{
    await addDoc(collection(dbCommunity,'channels',id,'posts'),{text, authorUid:currentUid(), authorName:await getMeName(), createdAt:serverTimestamp()});
    await updateDoc(doc(dbCommunity,'channels',id),{lastPost:text.slice(0,110), postCount:increment(1), updatedAt:serverTimestamp()});
    if(byId('kalbChannelPostText')) byId('kalbChannelPostText').value='';
  }catch(e){ console.warn(e); alert('Post failed. Check Firebase rules.'); }
};

window.kalbLoadPublicGroups = async function(){
  const box=byId('kalbPublicGroupsList'); if(!box) return;
  box.innerHTML='<div class="community-empty">Loading public groups...</div>';
  try{
    const snap=await getDocs(collection(dbCommunity,'groups'));
    kalbGroupsCache=[]; snap.forEach(d=>{ const g={id:d.id,...d.data()}; if(g.isPublic===true) kalbGroupsCache.push(g); });
    kalbGroupsCache.sort((a,b)=>(b.members||[]).length-(a.members||[]).length);
    window.kalbRenderPublicGroups();
  }catch(e){ console.warn(e); box.innerHTML='<div class="community-empty">Public groups could not load. Check Firestore rules for public group discovery.</div>'; }
};
window.kalbRenderPublicGroups = function(){
  const box=byId('kalbPublicGroupsList'); if(!box) return;
  const q=(byId('kalbPublicGroupSearch')?.value||'').toLowerCase().trim();
  const cat=byId('kalbPublicGroupCategory')?.value||'All';
  let list=kalbGroupsCache.filter(g=>(cat==='All'||(g.category||'General')===cat) && (!q || ((g.name||'')+' '+(g.desc||g.description||'')+' '+(g.category||'')).toLowerCase().includes(q)));
  if(!list.length){ box.innerHTML='<div class="community-empty">No public groups found. Create a public group.</div>'; return; }
  box.innerHTML=list.map(g=>{
    const joined=(g.members||[]).includes(currentUid());
    return `<div class="community-card">
      <h3>👥 ${esc(g.name||'Public Group')}</h3>
      <p>${esc(g.desc||g.description||'No description')}</p>
      <div class="community-meta"><span class="community-chip">${esc(g.category||'General')}</span><span class="community-chip">${(g.members||[]).length} members</span><span class="community-chip">Trending</span></div>
      <div class="community-actions">${joined?`<button class="btn small" onclick="openGroupRoom('${g.id}')">Open</button>`:`<button class="btn small green" onclick="kalbJoinPublicGroup('${g.id}')">Join</button>`}</div>
    </div>`;
  }).join('');
};
window.kalbCreatePublicGroup = async function(){
  if(!currentUid()) return alert('Login first.');
  const name=(byId('kalbPublicGroupName')?.value||'').trim();
  const desc=(byId('kalbPublicGroupDesc')?.value||'').trim();
  const category=byId('kalbPublicGroupNewCategory')?.value||'General';
  if(!name) return alert('Enter public group name.');
  const adminName=await getMeName();
  try{
    const ref=await addDoc(collection(dbCommunity,'groups'),{name, desc, category, isPublic:true, adminUid:currentUid(), adminName, members:[currentUid()], createdAt:serverTimestamp(), updatedAt:serverTimestamp(), lastMessage:''});
    if(byId('kalbPublicGroupName')) byId('kalbPublicGroupName').value='';
    if(byId('kalbPublicGroupDesc')) byId('kalbPublicGroupDesc').value='';
    byId('kalbCreatePublicGroupBox')?.classList.add('hidden');
    await window.kalbLoadPublicGroups();
    if(window.openGroupRoom) window.openGroupRoom(ref.id);
  }catch(e){ console.warn(e); alert('Public group create failed. Check Firebase rules.'); }
};
window.kalbJoinPublicGroup = async function(id){
  if(!currentUid()) return alert('Login first.');
  try{
    await updateDoc(doc(dbCommunity,'groups',id),{members:arrayUnion(currentUid()), updatedAt:serverTimestamp()});
    await window.kalbLoadPublicGroups();
    if(window.openGroupRoom) window.openGroupRoom(id);
  }catch(e){ console.warn(e); alert('Join failed. Check Firebase rules.'); }
};

onAuthStateChanged(authCommunity, user=>{
  communityUser=user;
  if(user){ startChannelsListener(); setTimeout(()=>{ try{ window.kalbLoadPublicGroups(); }catch(e){} }, 800); }
});
setTimeout(()=>{ if(authCommunity.currentUser){ communityUser=authCommunity.currentUser; startChannelsListener(); window.kalbLoadPublicGroups(); } },1500);
