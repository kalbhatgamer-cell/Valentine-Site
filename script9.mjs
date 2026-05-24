
/* REAL ACCEPTED FRIENDS ONLY FOR CALL PAGE - final override */
(function(){
  const clean = v => String(v ?? '').replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[m]));
  const dbx = () => (window.dbFix || window.db || (typeof dbFix !== 'undefined' ? dbFix : (typeof db !== 'undefined' ? db : null)));
  const authx = () => (window.authFix || window.auth || (typeof authFix !== 'undefined' ? authFix : (typeof auth !== 'undefined' ? auth : null)));
  const uidOf = u => u?.uid || u?.id || u?.userId || u?.docId || '';
  const usernameOf = u => (u?.username || u?.userName || (u?.email ? String(u.email).split('@')[0] : 'user')).toString().replace(/^@/,'');
  const nameOf = u => {
    let n = u?.displayName || u?.name || u?.fullName || u?.username || (u?.email ? String(u.email).split('@')[0] : 'User');
    n = String(n || 'User');
    if(/^https?:\/\//i.test(n) || n.length > 40) n = u?.username || (u?.email ? String(u.email).split('@')[0] : 'User');
    return n || 'User';
  };
  const avatarOf = u => clean(u?.avatarEmoji || u?.avatar || (nameOf(u)[0] || 'U').toUpperCase());
  const isOnline = u => u?.online === true || u?.isOnline === true || String(u?.status||'').toLowerCase()==='online';

  async function readUser(uid){
    const d = dbx(); if(!d || !uid) return null;
    try{
      if(typeof getDoc === 'function' && typeof doc === 'function'){
        const s = await getDoc(doc(d,'users',uid));
        return s.exists() ? {uid, id:uid, ...s.data()} : null;
      }
    }catch(e){ console.warn('readUser failed', e); }
    return null;
  }
  async function readAllUsers(){
    if(typeof window.getAllUsersFix === 'function') return await window.getAllUsersFix();
    const d = dbx(); if(!d) return window.allUsers || [];
    try{
      const s = await getDocs(collection(d,'users'));
      return s.docs.map(x=>({uid:x.id,id:x.id,...x.data()}));
    }catch(e){ console.warn('readAllUsers failed', e); return window.allUsers || []; }
  }

  async function getRealAcceptedCallFriends(){
    const a = authx();
    const me = a?.currentUser;
    if(!me) return {me:null, friends:[]};
    const myDoc = await readUser(me.uid);
    const all = await readAllUsers();
    const byId = new Map(all.map(u => [uidOf(u), u]));
    const myArray = Array.isArray(myDoc?.friends) ? myDoc.friends.map(String) : [];

    // MAIN RULE: show only users who are still inside my current friends array.
    // This makes unfriended users disappear immediately from the call list.
    let ids = [...new Set(myArray)].filter(id => id && id !== me.uid);

    // Extra safety: if the other user's friends array exists, require that it still contains me too.
    ids = ids.filter(id => {
      const other = byId.get(id);
      if(!other) return false;
      if(Array.isArray(other.friends)) return other.friends.map(String).includes(me.uid);
      return true;
    });

    // Fallback only for old accounts that do not have any friends array saved.
    if(ids.length === 0 && !Array.isArray(myDoc?.friends)){
      try{
        const snap = await getDocs(collection(dbx(),'friendRequests'));
        const accepted = new Set();
        const removed = new Set();
        snap.forEach(ds=>{
          const r = ds.data() || {};
          const from = String(r.fromUid || r.fromId || r.senderId || '');
          const to = String(r.toUid || r.toId || r.receiverId || '');
          if(!from || !to || (from !== me.uid && to !== me.uid)) return;
          const other = from === me.uid ? to : from;
          const st = String(r.status || '').toLowerCase();
          if(st === 'accepted') accepted.add(other);
          if(['unfriended','removed','rejected','blocked','cancelled','canceled'].includes(st)) removed.add(other);
        });
        ids = [...accepted].filter(id => !removed.has(id));
      }catch(e){ console.warn('friendRequests fallback failed', e); }
    }

    const friends = ids.map(id => byId.get(id)).filter(Boolean);
    return {me, friends};
  }

  window.getRealAcceptedCallFriends = getRealAcceptedCallFriends;
  window.getMyFriendsStrict = getRealAcceptedCallFriends;

  window.renderCallUsersList = async function(){
    const box = document.getElementById('callUsersList') || document.getElementById('directCallUsers') || document.querySelector('#callsTab .users-list') || document.querySelector('#callsPage .users-list');
    if(!box) return;
    box.innerHTML = '<div class="card"><p class="muted">Loading accepted friends...</p></div>';
    const {me, friends} = await getRealAcceptedCallFriends();
    if(!me){ box.innerHTML = '<div class="card"><p class="muted">Please login first.</p></div>'; return; }
    const q = (document.getElementById('callSearch')?.value || document.querySelector('input[placeholder*="call" i]')?.value || '').toLowerCase().trim();
    const filtered = friends.filter(u => !q || [nameOf(u), usernameOf(u), u.email||''].join(' ').toLowerCase().includes(q));
    const fc = document.getElementById('callFriendsCount') || document.getElementById('callFriendsStat');
    const oc = document.getElementById('callOnlineCount') || document.getElementById('callOnlineStat');
    if(fc) fc.textContent = String(friends.length);
    if(oc) oc.textContent = String(friends.filter(isOnline).length);
    if(!filtered.length){
      box.innerHTML = '<div class="card"><p class="muted">No accepted friends to call. Only users in your My Friends list will show here.</p></div>';
      return;
    }
    box.innerHTML = filtered.map(u => `
      <div class="card call-friend-card" style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin:10px 0;overflow:hidden;">
        <div class="avatar">${avatarOf(u)}</div>
        <div style="min-width:0;">
          <b style="color:#38d9ff;font-size:20px;word-break:break-word;">${clean(nameOf(u))}</b><br>
          <span class="muted">${isOnline(u)?'Online':'Offline'} • @${clean(usernameOf(u))}</span>
        </div>
        <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn small" onclick="startDirectCall('${clean(uidOf(u))}','video')">Video</button>
          <button class="btn small" onclick="startDirectCall('${clean(uidOf(u))}','voice')">Voice</button>
        </div>
      </div>`).join('');
  };
  window.loadCallUsers = window.renderCallUsersList;
  window.refreshCallUsers = window.renderCallUsersList;
  document.addEventListener('click', e => {
    const txt = String(e.target?.innerText || '').toLowerCase().trim();
    if(txt === 'calls' || txt === 'call' || txt === 'refresh friends') setTimeout(()=>window.renderCallUsersList(), 250);
  }, true);
})();
