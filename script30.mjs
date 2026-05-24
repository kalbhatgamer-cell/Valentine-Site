
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",authDomain:"kalb-message.firebaseapp.com",projectId:"kalb-message",storageBucket:"kalb-message.firebasestorage.app",messagingSenderId:"139873273901",appId:"1:139873273901:web:c7c079d385daeb3401d0a4",measurementId:"G-C9S0K1SG0D"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const getTime=p=>((p?.createdAt?.seconds)||(p?.updatedAt?.seconds)||0);
const fmt=t=>{try{return t?.seconds?new Date(t.seconds*1000).toLocaleString():""}catch(e){return ""}};
const K={user:null,me:null,users:[],posts:[],unsubs:[],commentUnsubs:{},stories:[],storyIndex:0};
function uidOf(u){return u?.uid||u?.id||""}
function userByUid(uid){return K.users.find(u=>uidOf(u)===uid)||{};}
function nameOf(u,fb="User"){return u?.name||u?.displayName||u?.username||String(u?.email||fb).split('@')[0]||fb;}
function initial(v){const s=String(v||'U').trim();return Array.from(s)[0]?.toUpperCase()||'U';}
function avatarBg(u){return u?.avatarColor?`background:linear-gradient(135deg,#22d3ee,#8b5cf6,#22c55e)`:'background:linear-gradient(135deg,#22d3ee,#8b5cf6)'}
function isStory(p){return p?.type==='story'||p?.type==='status'||p?.isStory===true;}
function isPost(p){return !isStory(p);}
function canViewPost(p){
  if(!p||!K.user)return false;
  const uid=p.uid||p.userId||p.authorUid||'';
  if(uid===K.user.uid)return true;
  const privacy=p.privacy||'public';
  if(privacy==='private')return false;
  if(privacy==='friends'){
    const owner=userByUid(uid);
    const ownerFriends=Array.isArray(owner.friends)?owner.friends:[];
    const myFriends=Array.isArray(K.me?.friends)?K.me.friends:[];
    return ownerFriends.includes(K.user.uid)||myFriends.includes(uid);
  }
  return true;
}
function currentFilter(){return String(window.feedFilter||window.__kalbFeedFilter||'newest').toLowerCase();}
function filteredPosts(){
  let list=K.posts.filter(isPost).filter(canViewPost);
  const f=currentFilter();
  if(f==='saved') list=list.filter(p=>Array.isArray(p.savedBy)&&p.savedBy.includes(K.user?.uid));
  else if(f==='mine') list=list.filter(p=>(p.uid||p.userId||p.authorUid)===K.user?.uid);
  else if(f==='trending') list.sort((a,b)=>scorePost(b)-scorePost(a));
  else list.sort((a,b)=>{ if(a.pinned&&!b.pinned)return -1; if(!a.pinned&&b.pinned)return 1; return getTime(b)-getTime(a); });
  return list;
}
function scorePost(p){return (Array.isArray(p.likes)?p.likes.length:0)+(Number(p.commentsCount||0)*2)+Object.values(p.reactions||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);}
function reactionCount(p,e){const r=p.reactions||{}; return Array.isArray(r[e])?r[e].length:0;}
function commentsCount(p){return Number(p.commentsCount||0);}
function postText(p){return p.text||p.content||p.caption||'';}
function updateFilterButtons(){
  const f=currentFilter();
  document.querySelectorAll('.filter-row button,.social-tabs button').forEach(b=>{
    const t=(b.textContent||'').toLowerCase();
    b.classList.toggle('kalb-feed-active',(f==='newest'||f==='new')&&t.includes('newest')||f==='trending'&&t.includes('trending')||f==='saved'&&t.includes('saved')||f==='mine'&&t.includes('my posts'));
  });
}
function renderStories(){
  const box=$('storyStrip'); if(!box)return;
  const stories=K.posts.filter(isStory).filter(canViewPost).sort((a,b)=>getTime(b)-getTime(a)).slice(0,20);
  box.innerHTML=stories.length?stories.map(s=>{
    const uid=s.uid||s.userId||s.authorUid||''; const u=userByUid(uid); const nm=s.name||nameOf(u); const txt=postText(s);
    const views=Array.isArray(s.views)?s.views.length:0;
    return `<div class="story-item" onclick="openStoryViewer('${esc(s.id)}')"><b>${esc(nm)}</b><p>${esc(txt||'Story/Status')}</p><small>${views} view${views===1?'':'s'}</small></div>`;
  }).join(''):'<div class="story-item muted">No stories yet.</div>';
}
function renderPostList(boxId,posts,limit){
  const box=$(boxId); if(!box)return;
  const list=(limit?posts.slice(0,limit):posts);
  if(!list.length){box.innerHTML='<div class="card empty">No posts yet. Be the first to post.</div>';return;}
  const key=String(boxId).replace(/[^a-zA-Z0-9_-]/g,'_');
  box.innerHTML=list.map(p=>{
    const uid=p.uid||p.userId||p.authorUid||''; const u=userByUid(uid); const nm=p.name||nameOf(u); const un=p.username||u.username||String(p.email||u.email||'user').split('@')[0];
    const mine=uid===K.user?.uid; const liked=Array.isArray(p.likes)&&p.likes.includes(K.user?.uid); const saved=Array.isArray(p.savedBy)&&p.savedBy.includes(K.user?.uid);
    const privacy=p.privacy==='private'?'🔒 Private':p.privacy==='friends'?'👥 Friends':'🌍 Public'; const emojis=['❤️','😂','😮','😢','👍'];
    return `<div class="post-box" data-post-id="${esc(p.id)}">
      ${p.pinned?'<span class="post-pin">Pinned</span>':''}<span class="post-pin">${privacy}</span>
      <div class="post-head"><div class="avatar" onclick="viewUserProfile('${esc(uid)}')" style="cursor:pointer;${avatarBg(u)}">${esc(u.avatarEmoji||p.avatarEmoji||initial(nm))}</div><div class="user-info"><h3>${esc(nm)}</h3><p>@${esc(un)} • ${esc(fmt(p.createdAt)||'')}</p><button class="feed-profile-btn" onclick="viewUserProfile('${esc(uid)}')">View Profile</button></div></div>
      <div class="post-text">${esc(postText(p))}</div>
      <div class="post-actions">
        <div class="reaction-row" style="width:100%;display:flex;gap:7px;flex-wrap:wrap">${emojis.map(e=>`<button class="react-btn" onclick="kalbFeedFixReact('${esc(p.id)}','${e}')">${e} ${reactionCount(p,e)}</button>`).join('')}</div>
        <button class="btn small ${liked?'green':''}" onclick="kalbFeedFixLike('${esc(p.id)}')">${liked?'Liked':'Like'} (${Array.isArray(p.likes)?p.likes.length:0})</button>
        <button class="btn small" onclick="kalbToggleComments('${esc(p.id)}','${key}')">Comments (<span data-kalb-comment-count="${esc(p.id)}">${commentsCount(p)}</span>)</button>
        <button class="btn small ${saved?'green':''}" onclick="kalbFeedFixSave('${esc(p.id)}')">${saved?'Saved':'Save'}</button>
        <button class="btn small" onclick="kalbFeedFixRepost('${esc(p.id)}')">Repost</button>
        ${mine?`<button class="btn small red" onclick="kalbFeedFixDelete('${esc(p.id)}')">Delete</button>`:`<button class="btn small red" onclick="kalbFeedFixReport('${esc(p.id)}')">Report</button>`}
      </div>
      <div id="kalbComments_${key}_${esc(p.id)}" class="kalb-comment-panel" data-post-id="${esc(p.id)}">
        <div id="kalbCommentList_${key}_${esc(p.id)}" class="kalb-comment-list"><p class="muted">Open comments to load.</p></div>
        <div class="kalb-comment-compose"><input id="kalbCommentInput_${key}_${esc(p.id)}" placeholder="Write a comment..."><button class="btn small" onclick="kalbAddComment('${esc(p.id)}','${key}')">Send</button></div>
      </div>
    </div>`;
  }).join('');
}
function renderAll(){
  const posts=filteredPosts();
  renderPostList('homeFeedBox',posts,8);
  renderPostList('postsBox',posts);
  renderStories();
  updateFilterButtons();
}
window.setFeedFilter=function(type){window.__kalbFeedFilter=type==='new'?'newest':(type||'newest');window.feedFilter=window.__kalbFeedFilter;renderAll();};
window.renderPosts=renderAll;
window.kalbFeedFixRender=renderAll;
window.createPostFromHome=async function(){return kalbCreatePost('home')};
window.createPost=async function(source){return kalbCreatePost(source||'feed')};
async function meDoc(){
  if(!K.user)return null;
  if(K.me)return K.me;
  try{const s=await getDoc(doc(db,'users',K.user.uid));K.me=s.exists()?{uid:K.user.uid,...s.data()}:{uid:K.user.uid,email:K.user.email||'',name:K.user.displayName||'User'};}catch(e){K.me={uid:K.user.uid,email:K.user.email||'',name:K.user.displayName||'User'};}
  return K.me;
}
async function kalbCreatePost(source){
  if(!K.user)return alert('Login first.');
  const home=$('homePostText'); const feed=$('postText');
  let box=source==='home'?home:(source==='feed'?feed:null);
  if(!box){box=(home&&home.value.trim())?home:((feed&&feed.value.trim())?feed:(home||feed));}
  const text=String(box?.value||'').trim(); if(!text)return alert('Write something first.');
  const me=await meDoc()||{}; const privacy=$('newPostPrivacy')?.value||$('postPrivacy')?.value||'public';
  try{
    await addDoc(collection(db,'posts'),{text,content:text,type:'post',privacy,uid:K.user.uid,userId:K.user.uid,authorUid:K.user.uid,email:K.user.email||'',name:nameOf(me,K.user.displayName||'User'),username:me.username||String(K.user.email||'user').split('@')[0],likes:[],savedBy:[],commentsCount:0,reactions:{},createdAt:serverTimestamp()});
    if(box)box.value='';
  }catch(e){console.error(e);alert('Post failed: '+(e.message||e));}
}
window.createStoryPost=async function(){
  if(!K.user)return alert('Login first.');
  const box=$('homePostText')||$('postText'); const text=String(box?.value||'').trim();
  if(!text)return alert('Write something first.');
  const me=await meDoc()||{};
  try{
    await addDoc(collection(db,'posts'),{text,content:text,type:'story',privacy:'public',uid:K.user.uid,userId:K.user.uid,authorUid:K.user.uid,email:K.user.email||'',name:nameOf(me,K.user.displayName||'User'),username:me.username||String(K.user.email||'user').split('@')[0],views:[],likes:[],savedBy:[],commentsCount:0,reactions:{},createdAt:serverTimestamp()});
    if(box)box.value='';
    setTimeout(renderAll,500);
  }catch(e){console.error(e);alert('Story/Status failed: '+(e.message||e));}
};
function pById(id){return K.posts.find(p=>p.id===id)||null;}
window.kalbFeedFixLike=async function(id){const p=pById(id); if(!K.user||!p)return; const liked=Array.isArray(p.likes)&&p.likes.includes(K.user.uid); try{await updateDoc(doc(db,'posts',id),{likes:liked?arrayRemove(K.user.uid):arrayUnion(K.user.uid)});}catch(e){alert('Like failed: '+(e.message||e));}};
window.kalbFeedFixSave=async function(id){const p=pById(id); if(!K.user||!p)return; const saved=Array.isArray(p.savedBy)&&p.savedBy.includes(K.user.uid); try{await updateDoc(doc(db,'posts',id),{savedBy:saved?arrayRemove(K.user.uid):arrayUnion(K.user.uid)});}catch(e){alert('Save failed: '+(e.message||e));}};
window.kalbFeedFixReact=async function(id,emoji){if(!K.user)return alert('Login first.');try{await updateDoc(doc(db,'posts',id),{[`reactions.${emoji}`]:arrayUnion(K.user.uid)});}catch(e){alert('Reaction failed: '+(e.message||e));}};
window.kalbFeedFixRepost=async function(id){const p=pById(id); if(!K.user||!p)return; const me=await meDoc()||{}; try{await addDoc(collection(db,'posts'),{text:'Repost: '+postText(p),content:'Repost: '+postText(p),type:'repost',privacy:'public',uid:K.user.uid,userId:K.user.uid,email:K.user.email||'',name:nameOf(me,K.user.displayName||'User'),username:me.username||String(K.user.email||'user').split('@')[0],likes:[],savedBy:[],commentsCount:0,reactions:{},repostOf:id,createdAt:serverTimestamp()});}catch(e){alert('Repost failed: '+(e.message||e));}};
window.kalbFeedFixDelete=async function(id){if(!confirm('Delete this post?'))return; try{await deleteDoc(doc(db,'posts',id));}catch(e){alert('Delete failed: '+(e.message||e));}};
window.kalbFeedFixReport=async function(id){if(!K.user)return alert('Login first.'); const reason=prompt('Report reason','Unsafe or inappropriate post')||'Reported post'; try{await addDoc(collection(db,'reports'),{type:'post',postId:id,reason,reporterUid:K.user.uid,createdAt:serverTimestamp(),status:'pending'});alert('Report sent.');}catch(e){alert('Report failed: '+(e.message||e));}};
window.kalbToggleComments=function(id,key){
  const panel=$(`kalbComments_${key}_${id}`); if(!panel)return alert('Comment box not found. Refresh once.');
  const open=!panel.classList.contains('show'); panel.classList.toggle('show',open);
  if(open)loadComments(id,key);
};
function loadComments(id,key){
  const list=$(`kalbCommentList_${key}_${id}`); if(!list)return;
  list.innerHTML='<p class="muted">Loading comments...</p>';
  const ukey=key+'_'+id; if(K.commentUnsubs[ukey]){try{K.commentUnsubs[ukey]()}catch(e){}}
  try{
    K.commentUnsubs[ukey]=onSnapshot(query(collection(db,'posts',id,'comments'),orderBy('createdAt','asc')),snap=>{
      const arr=[]; snap.forEach(d=>arr.push({id:d.id,...d.data()}));
      document.querySelectorAll(`[data-kalb-comment-count="${CSS.escape(id)}"]`).forEach(el=>el.textContent=arr.length);
      list.innerHTML=arr.length?arr.map(c=>`<div class="kalb-comment-item"><b>${esc(c.name||c.username||c.email||'User')}</b><p>${esc(c.text||'')}</p><small>${esc(fmt(c.createdAt))}</small></div>`).join(''):'<p class="muted">No comments yet.</p>';
    },e=>{console.error(e);list.innerHTML='<p class="muted">Comments could not load. Check Firestore rules.</p>';});
  }catch(e){list.innerHTML='<p class="muted">Comments could not load.</p>';}
}
window.kalbAddComment=async function(id,key){
  if(!K.user)return alert('Login first.'); const input=$(`kalbCommentInput_${key}_${id}`); const text=String(input?.value||'').trim(); if(!text)return;
  const me=await meDoc()||{};
  try{await addDoc(collection(db,'posts',id,'comments'),{text,uid:K.user.uid,email:K.user.email||'',name:nameOf(me,K.user.displayName||'User'),username:me.username||String(K.user.email||'user').split('@')[0],createdAt:serverTimestamp()}); if(input)input.value=''; await updateDoc(doc(db,'posts',id),{commentsCount:increment(1)}).catch(()=>{}); loadComments(id,key);}catch(e){alert('Comment failed: '+(e.message||e));}
};
function viewerNames(story){
  const ids=Array.isArray(story.views)?story.views:[];
  return ids.map(uid=>nameOf(userByUid(uid),'Unknown user'));
}
async function markStoryViewed(story){
  if(!K.user||!story?.id)return;
  const owner=story.uid||story.userId||story.authorUid||'';
  if(owner===K.user.uid)return;
  const views=Array.isArray(story.views)?story.views:[];
  if(views.includes(K.user.uid))return;
  try{await updateDoc(doc(db,'posts',story.id),{views:arrayUnion(K.user.uid)});story.views=[...views,K.user.uid];}catch(e){console.warn('Story view update failed',e);}
}
async function renderStoryViewer(){
  const s=K.stories[K.storyIndex]; if(!s)return;
  await markStoryViewed(s);
  const uid=s.uid||s.userId||s.authorUid||''; const u=userByUid(uid); const nm=s.name||nameOf(u); const txt=postText(s)||'No story text.'; const views=Array.isArray(s.views)?s.views:[];
  const set=(id,val)=>{const el=$(id); if(el)el.innerHTML=val;};
  set('storyViewerAvatar',esc(u.avatarEmoji||s.avatarEmoji||initial(nm)));
  set('storyViewerName',esc(nm));
  set('storyViewerTime',esc(fmt(s.createdAt)||'Story/Status'));
  set('storyViewerText',esc(txt));
  set('storyViewerCount',`${views.length} view${views.length===1?'':'s'}`);
  const names=viewerNames(s);
  set('storyViewerViewers',names.length?names.map(n=>`<div>👁️ ${esc(n)}</div>`).join(''):'<div>No viewers yet.</div>');
}
window.openStoryViewer=async function(id){
  K.stories=K.posts.filter(isStory).filter(canViewPost).sort((a,b)=>getTime(b)-getTime(a));
  K.storyIndex=Math.max(0,K.stories.findIndex(s=>s.id===id));
  await renderStoryViewer();
  const modal=$('storyViewerModal'); if(modal){modal.classList.add('show');modal.setAttribute('aria-hidden','false');modal.style.display='flex';}
};
window.closeStoryViewer=function(){const modal=$('storyViewerModal'); if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');modal.style.display='';}};
window.nextStory=async function(){if(!K.stories.length)return;K.storyIndex=(K.storyIndex+1)%K.stories.length;await renderStoryViewer();};
window.prevStory=async function(){if(!K.stories.length)return;K.storyIndex=(K.storyIndex-1+K.stories.length)%K.stories.length;await renderStoryViewer();};
window.toggleStoryViewers=function(){const box=$('storyViewerViewers'); if(box)box.classList.toggle('show');};
function start(u){
  K.user=u; K.unsubs.forEach(fn=>{try{fn()}catch(e){}}); K.unsubs=[];
  meDoc().then(renderAll).catch(()=>{});
  K.unsubs.push(onSnapshot(collection(db,'users'),snap=>{K.users=[];snap.forEach(d=>K.users.push({uid:d.id,...d.data()}));K.me=K.users.find(x=>uidOf(x)===u.uid)||K.me;renderAll();},e=>console.warn(e)));
  K.unsubs.push(onSnapshot(query(collection(db,'posts'),orderBy('createdAt','desc')),snap=>{K.posts=[];snap.forEach(d=>K.posts.push({id:d.id,...d.data()}));renderAll();},e=>{console.warn(e);getDocs(collection(db,'posts')).then(snap=>{K.posts=[];snap.forEach(d=>K.posts.push({id:d.id,...d.data()}));renderAll();}).catch(console.warn);}));
  setTimeout(()=>getDocs(collection(db,'posts')).then(snap=>{K.posts=[];snap.forEach(d=>K.posts.push({id:d.id,...d.data()}));renderAll();}).catch(()=>{}),1600);
}
onAuthStateChanged(auth,u=>{if(!u)return;start(u);});
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(auth.currentUser)start(auth.currentUser);else renderAll();},900));
window.addEventListener('load',()=>setTimeout(()=>{if(auth.currentUser)start(auth.currentUser);},1400));
