
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const authFix = getAuth(app);
const dbFix = getFirestore(app);
let authReadyUser = authFix.currentUser || null;
onAuthStateChanged(authFix, u => { authReadyUser = u; });

const $fix = id => document.getElementById(id);
function escFix(s){return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function getMeFix(){ return authFix.currentUser || authReadyUser || null; }
async function waitMeFix(){
  const u = getMeFix();
  if(u) return u;
  return await new Promise(resolve => {
    const stop = onAuthStateChanged(authFix, user => { stop(); authReadyUser = user; resolve(user || null); });
    setTimeout(() => { try{stop();}catch(e){} resolve(getMeFix()); }, 1500);
  });
}
async function getUserFix(uid){
  if(!uid) return null;
  const snap = await getDoc(doc(dbFix,'users',uid));
  return snap.exists() ? {uid, ...snap.data()} : null;
}
async function getAllUsersFix(){
  const snap = await getDocs(collection(dbFix,'users'));
  return snap.docs.map(d=>({uid:d.id, ...d.data()}));
}
function looksBadNameFix(v){
  v = String(v || '').trim();
  return !v || /^https?:\/\//i.test(v) || v.length > 45 || /googleusercontent\.com|lh3\.googleusercontent\.com/i.test(v) || v.includes('?') || v.includes('/');
}
function cleanTextFix(v, fallback=''){
  v = String(v || '').trim();
  if(looksBadNameFix(v)) return fallback;
  return v;
}
function displayNameRawFix(u){
  const fromName = cleanTextFix(u?.displayName) || cleanTextFix(u?.name) || cleanTextFix(u?.fullName);
  if(fromName) return fromName;
  const username = cleanTextFix(u?.username || u?.userName || u?.handle);
  if(username) return username.replace(/^@+/, '');
  const email = cleanTextFix(u?.email);
  if(email) return email.split('@')[0];
  return 'User';
}
function usernameRawFix(u){
  const username = cleanTextFix(u?.username || u?.userName || u?.handle);
  if(username) return '@' + username.replace(/^@+/, '');
  const email = cleanTextFix(u?.email);
  return email || '';
}
function avatarRawFix(u){
  const av = cleanTextFix(u?.avatar || u?.emojiAvatar || u?.avatarEmoji);
  if(av && av.length <= 4) return av;
  const n = displayNameRawFix(u);
  return n ? n[0].toUpperCase() : '👤';
}
function nameFix(u){ return escFix(displayNameRawFix(u)); }
function unameFix(u){ return escFix(usernameRawFix(u)); }
function avatarFix(u){ return escFix(avatarRawFix(u)); }
function isFriendFix(myProfile, uid){ return Array.isArray(myProfile?.friends) && myProfile.friends.includes(uid); }
function cardFix(u, buttons=''){
  return `<div class="user-row friend-card"><div class="avatar">${avatarFix(u)}</div><div class="user-info"><b>${nameFix(u)}</b><p class="muted">${unameFix(u)}${u?.bio ? ' • '+escFix(u.bio) : ''}</p></div><div class="actions">${buttons}</div></div>`;
}
async function pendingRequestsForMeFix(me){
  const all = [];
  try{
    const qs = await getDocs(query(collection(dbFix,'friendRequests'), where('status','==','pending')));
    qs.forEach(d=>{ const r={id:d.id,...d.data()}; if([r.toUid,r.toId,r.receiverId,r.to].includes(me.uid) || r.toEmail===me.email) all.push(r); });
  }catch(e){
    const qs = await getDocs(collection(dbFix,'friendRequests'));
    qs.forEach(d=>{ const r={id:d.id,...d.data()}; if((!r.status || r.status==='pending') && ([r.toUid,r.toId,r.receiverId,r.to].includes(me.uid) || r.toEmail===me.email)) all.push(r); });
  }
  // support old sub-collection style too
  for(const path of [`users/${me.uid}/friendRequests`,`users/${me.uid}/requests`]){
    try{ const qs=await getDocs(collection(dbFix,path)); qs.forEach(d=>{ const r={id:d.id,...d.data()}; if(!r.status || r.status==='pending') all.push(r); }); }catch(e){}
  }
  const seen = new Set();
  return all.filter(r=>{ const from=r.fromUid||r.fromId||r.senderId||r.from||r.uid||r.id; if(!from || from===me.uid || seen.has(from)) return false; seen.add(from); return true; });
}

window.renderFriendRequests = async function(){
  const me = await waitMeFix();
  const boxes = [$fix('friendRequestsBox'), $fix('friendsListBox')].filter(Boolean);
  boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Loading incoming friend requests...</p></div>');
  if(!me){ boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Please login first.</p></div>'); return; }
  try{
    const reqs = await pendingRequestsForMeFix(me);
    if(!reqs.length){ boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">No incoming friend requests.</p></div>'); return; }
    const rows = [];
    for(const r of reqs){
      const fromUid = r.fromUid || r.fromId || r.senderId || r.from || r.uid || r.id;
      const user = (await getUserFix(fromUid)) || {uid:fromUid, displayName:r.fromName||r.senderName||'User', username:r.fromUsername||'', email:r.fromEmail||''};
      rows.push(cardFix(user, `<button class="btn small green" onclick="acceptFriendRequest('${escFix(r.id)}','${escFix(fromUid)}')">Accept</button><button class="btn small red" onclick="rejectFriendRequest('${escFix(r.id)}','${escFix(fromUid)}')">Reject</button><button class="btn small" onclick="openUserProfile('${escFix(fromUid)}')">Profile</button>`));
    }
    boxes.forEach(b=>b.innerHTML = rows.join(''));
    const usersList=$fix('usersList'); if(usersList) usersList.innerHTML='';
    const title=document.querySelector('.friends-section-title'); if(title) title.textContent='Friend Requests';
  }catch(e){ boxes.forEach(b=>b.innerHTML = `<div class="card"><p class="muted">Could not load requests: ${escFix(e.message)}</p></div>`); }
};
window.refreshSearchPage = window.renderFriendRequests;

window.acceptFriendRequest = async function(reqId, fromUid){
  const me = await waitMeFix(); if(!me) return alert('Please login first.');
  if(!fromUid) return alert('Request user missing.');
  try{
    await setDoc(doc(dbFix,'users',me.uid), {friends: arrayUnion(fromUid), updatedAt: serverTimestamp()}, {merge:true});
    await setDoc(doc(dbFix,'users',fromUid), {friends: arrayUnion(me.uid), updatedAt: serverTimestamp()}, {merge:true});
    if(reqId){ try{ await updateDoc(doc(dbFix,'friendRequests',reqId), {status:'accepted', acceptedAt: serverTimestamp()}); }catch(e){ try{ await deleteDoc(doc(dbFix,'friendRequests',reqId)); }catch(x){} } }
    for(const path of [`users/${me.uid}/friendRequests/${fromUid}`,`users/${me.uid}/requests/${fromUid}`]){ try{ await deleteDoc(doc(dbFix,path)); }catch(e){} }
    alert('Friend request accepted.');
    window.renderFriendRequests();
  }catch(e){ alert('Accept failed: '+e.message); }
};
window.rejectFriendRequest = async function(reqId, fromUid){
  const me = await waitMeFix(); if(!me) return alert('Please login first.');
  try{
    if(reqId){ try{ await updateDoc(doc(dbFix,'friendRequests',reqId), {status:'rejected', rejectedAt: serverTimestamp()}); }catch(e){ try{ await deleteDoc(doc(dbFix,'friendRequests',reqId)); }catch(x){} } }
    for(const path of [`users/${me.uid}/friendRequests/${fromUid}`,`users/${me.uid}/requests/${fromUid}`]){ try{ await deleteDoc(doc(dbFix,path)); }catch(e){} }
    window.renderFriendRequests();
  }catch(e){ alert('Reject failed: '+e.message); }
};

window.renderFriendsList = async function(){
  const me = await waitMeFix();
  const boxes = [$fix('friendsListBox'), $fix('friendsOnlyBox')].filter(Boolean);
  boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Loading accepted friends...</p></div>');
  const title=document.querySelector('.friends-section-title'); if(title) title.textContent='My Friends';
  if(!me){ boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Please login first.</p></div>'); return; }
  try{
    const myProfile = await getUserFix(me.uid) || {};
    const ids = Array.isArray(myProfile.friends) ? [...new Set(myProfile.friends.filter(x=>x && x!==me.uid))] : [];
    if(!ids.length){ boxes.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">No accepted friends yet.</p></div>'); return; }
    const rows=[];
    for(const id of ids){
      const u = await getUserFix(id) || {uid:id, displayName:'Friend'};
      rows.push(cardFix(u, `<button class="btn small" onclick="openUserProfile('${escFix(id)}')">Profile</button><button class="btn small red" onclick="unfriendUser('${escFix(id)}')">Unfriend</button><button class="btn small" onclick="openPrivateChat('${escFix(id)}')">Message</button><button class="btn small red" onclick="blockUser('${escFix(id)}')">Block</button>`));
    }
    boxes.forEach(b=>b.innerHTML = rows.join(''));
    const usersList=$fix('usersList'); if(usersList) usersList.innerHTML='';
  }catch(e){ boxes.forEach(b=>b.innerHTML = `<div class="card"><p class="muted">Could not load friends: ${escFix(e.message)}</p></div>`); }
};

window.renderUsers = async function(){
  const me = await waitMeFix();
  const box = $fix('usersList') || $fix('globalSearchResults');
  const gbox = $fix('globalSearchResults');
  const targets = [box, gbox].filter(Boolean);
  targets.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Loading users...</p></div>');
  const title=document.querySelector('.friends-section-title'); if(title) title.textContent='Find Users';
  if(!me){ targets.forEach(b=>b.innerHTML = '<div class="card"><p class="muted">Please login first.</p></div>'); return; }
  try{
    const search = (($fix('userSearch')?.value)||($fix('globalSearchInput')?.value)||'').toLowerCase().trim();
    const myProfile = await getUserFix(me.uid) || {};
    const friends = new Set(Array.isArray(myProfile.friends) ? myProfile.friends : []);
    const users = (await getAllUsersFix()).filter(u => u.uid !== me.uid && !friends.has(u.uid)).filter(u => !search || [displayNameRawFix(u),usernameRawFix(u),cleanTextFix(u.email)].join(' ').toLowerCase().includes(search));
    const rows = users.map(u => cardFix(u, `<button class="btn small" onclick="openUserProfile('${escFix(u.uid)}')">Profile</button><button class="btn small green" onclick="sendFriendRequest('${escFix(u.uid)}')">Add Friend</button><button class="btn small" onclick="openPrivateChat('${escFix(u.uid)}')">Message</button><button class="btn small red" onclick="blockUser('${escFix(u.uid)}')">Block</button><button class="btn small red" onclick="reportUser('${escFix(u.uid)}')">Report</button>`));
    const html = rows.length ? rows.join('') : '<div class="card"><p class="muted">No users found.</p></div>';
    targets.forEach(b=>b.innerHTML = html);
    const friendsBox=$fix('friendsListBox'); if(friendsBox && box?.id==='usersList') friendsBox.innerHTML='';
  }catch(e){ targets.forEach(b=>b.innerHTML = `<div class="card"><p class="muted">Could not load users: ${escFix(e.message)}</p></div>`); }
};

window.sendFriendRequest = async function(toUid){
  const me = await waitMeFix(); if(!me) return alert('Please login first.');
  if(!toUid || toUid===me.uid) return;
  try{
    const myProfile = await getUserFix(me.uid) || {};
    if(isFriendFix(myProfile,toUid)) return alert('This user is already your friend.');
    const receiver = await getUserFix(toUid) || {};
    const id = `${me.uid}_${toUid}`;
    await setDoc(doc(dbFix,'friendRequests',id), {
      fromUid: me.uid, fromId: me.uid, senderId: me.uid,
      toUid, toId: toUid, receiverId: toUid,
      fromEmail: me.email || '', toEmail: receiver.email || '',
      fromName: displayNameRawFix(myProfile || {email:me.email}) || me.email || 'User',
      status: 'pending', createdAt: serverTimestamp()
    }, {merge:true});
    alert('Friend request sent.');
  }catch(e){ alert('Friend request failed: '+e.message); }
};

window.unfriendUser = async function(uid){
  const me = await waitMeFix(); if(!me) return alert('Please login first.');
  if(!confirm('Unfriend this user?')) return;
  try{
    await setDoc(doc(dbFix,'users',me.uid), {friends: arrayRemove(uid), updatedAt: serverTimestamp()}, {merge:true});
    await setDoc(doc(dbFix,'users',uid), {friends: arrayRemove(me.uid), updatedAt: serverTimestamp()}, {merge:true});
    window.renderFriendsList();
  }catch(e){ alert('Unfriend failed: '+e.message); }
};

// Make the existing Users page buttons do exactly what they say.
document.addEventListener('click', (e)=>{
  const txt = (e.target?.innerText || '').trim().toLowerCase();
  if(e.target?.matches('button') && txt === 'requests') { e.preventDefault(); e.stopPropagation(); window.renderFriendRequests(); }
  if(e.target?.matches('button') && txt === 'my friends') { e.preventDefault(); e.stopPropagation(); window.renderFriendsList(); }
  if(e.target?.matches('button') && txt === 'find users') { e.preventDefault(); e.stopPropagation(); window.renderUsers(); }
}, true);
