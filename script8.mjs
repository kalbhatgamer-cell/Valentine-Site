
/* FINAL CALL FRIENDS FILTER FIX
   Calls page will show ONLY users who are still in my users/{uid}.friends array.
   If someone is unfriended, they disappear from Friends to Call immediately. */
(function(){
  function callEsc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function callName(u){
    const bad = v => !v || /^https?:\/\//i.test(String(v)) || /googleusercontent|lh3/i.test(String(v)) || String(v).length > 45;
    return bad(u?.displayName) ? (bad(u?.name) ? (bad(u?.username) ? 'User' : u.username) : u.name) : u.displayName;
  }
  function callUserName(u){
    let n = String(u?.username || '').trim();
    if(!n || /^https?:\/\//i.test(n) || n.length > 30) n = String((u?.email || callName(u) || 'user')).split('@')[0];
    return n.replace(/[^a-zA-Z0-9_.~-]/g,'').slice(0,30) || 'user';
  }
  function callAvatar(u){ return callEsc(u?.avatar || u?.emoji || (callName(u)||'U').trim()[0] || '👤'); }
  function onlineText(u){
    const online = !!(u?.online || u?.isOnline || u?.status === 'online');
    return online ? 'Online' : 'Offline';
  }
  function onlineCount(users){ return users.filter(u => !!(u?.online || u?.isOnline || u?.status === 'online')).length; }
  async function getMeCall(){
    if(typeof waitMeFix === 'function') return await waitMeFix();
    if(typeof authFix !== 'undefined' && authFix.currentUser) return authFix.currentUser;
    if(typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser;
    return null;
  }
  async function getMyFriendsStrict(){
    const me = await getMeCall();
    if(!me) return {me:null, friends:[]};
    let my = null;
    if(typeof getUserFix === 'function') my = await getUserFix(me.uid);
    else if(typeof dbFix !== 'undefined'){
      const snap = await getDoc(doc(dbFix,'users',me.uid));
      my = snap.exists() ? {uid:me.uid,...snap.data()} : null;
    }
    let ids = Array.isArray(my?.friends) ? my.friends.filter(Boolean) : [];
    // Do NOT use old accepted friendRequests as main source, because old accepted docs can remain after unfriend.
    // Use them only when the profile has no friends array at all.
    if(ids.length === 0 && my && !Array.isArray(my.friends)){
      try{
        const dbx = (typeof dbFix !== 'undefined') ? dbFix : db;
        const snap = await getDocs(collection(dbx,'friendRequests'));
        snap.forEach(d=>{
          const r=d.data()||{};
          if(String(r.status||'').toLowerCase() !== 'accepted') return;
          const from = r.fromUid || r.fromId || r.senderId;
          const to = r.toUid || r.toId || r.receiverId;
          if(from === me.uid && to) ids.push(to);
          if(to === me.uid && from) ids.push(from);
        });
      }catch(e){}
    }
    ids = [...new Set(ids)].filter(id => id && id !== me.uid);
    const all = (typeof getAllUsersFix === 'function') ? await getAllUsersFix() : (window.allUsers || []);
    const idset = new Set(ids);
    let friends = all.filter(u => idset.has(u.uid));
    return {me, friends};
  }
  window.renderCallUsersList = async function(){
    const box = document.getElementById('callUsersList') || document.getElementById('directCallUsers') || document.querySelector('#callsTab .users-list') || document.querySelector('#callsPage .users-list');
    if(!box) return;
    box.innerHTML = '<div class="card"><p class="muted">Loading accepted friends...</p></div>';
    try{
      const {me, friends} = await getMyFriendsStrict();
      if(!me){ box.innerHTML = '<div class="card"><p class="muted">Please login first.</p></div>'; return; }
      const search = (document.getElementById('callSearch')?.value || document.querySelector('#callsTab input[type="search"], #callsPage input[type="search"], input[placeholder*="call"]')?.value || '').toLowerCase().trim();
      const filtered = friends.filter(u => !search || [callName(u), callUserName(u), u.email||''].join(' ').toLowerCase().includes(search));
      const friendsCountEl = document.getElementById('callFriendsCount') || document.getElementById('callFriendsStat');
      const onlineCountEl = document.getElementById('callOnlineCount') || document.getElementById('callOnlineStat');
      if(friendsCountEl) friendsCountEl.textContent = String(friends.length);
      if(onlineCountEl) onlineCountEl.textContent = String(onlineCount(friends));
      if(!filtered.length){
        box.innerHTML = '<div class="card"><p class="muted">No accepted friends to call. Add/accept friends first.</p></div>';
        return;
      }
      box.innerHTML = filtered.map(u => `
        <div class="card call-friend-card" style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin:10px 0;">
          <div class="avatar">${callAvatar(u)}</div>
          <div>
            <b style="color:#38d9ff;font-size:20px">${callEsc(callName(u))}</b><br>
            <span class="muted">${onlineText(u)} • @${callEsc(callUserName(u))}</span>
          </div>
          <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn small" onclick="startDirectCall('${callEsc(u.uid)}','video')">Video</button>
            <button class="btn small" onclick="startDirectCall('${callEsc(u.uid)}','voice')">Voice</button>
          </div>
        </div>`).join('');
    }catch(e){
      console.error('call friends strict error', e);
      box.innerHTML = '<div class="card"><p class="muted">Could not load accepted friends: '+callEsc(e.message || e)+'</p></div>';
    }
  };
  // Keep old function names working too.
  window.loadCallUsers = window.renderCallUsersList;
  window.refreshCallUsers = window.renderCallUsersList;
  document.addEventListener('input', e=>{
    const ph = String(e.target?.placeholder || '').toLowerCase();
    if(ph.includes('call') && typeof window.renderCallUsersList === 'function') window.renderCallUsersList();
  });
  document.addEventListener('click', e=>{
    const t = (e.target?.innerText || '').toLowerCase().trim();
    if(t === 'calls' || t === 'call' || t === 'refresh friends') setTimeout(()=>window.renderCallUsersList(), 300);
  }, true);
})();
