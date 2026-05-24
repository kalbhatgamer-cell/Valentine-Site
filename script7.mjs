
/* FINAL FIX: Profile button alias for My Friends + Find Users pages */
(function(){
  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
  async function robustOpenProfile(uid){
    try{
      uid = String(uid || '').trim();
      if(!uid){ alert('Profile not found'); return; }
      if(typeof window.viewUserProfile === 'function'){
        return await window.viewUserProfile(uid);
      }
      await wait(200);
      if(typeof window.viewUserProfile === 'function'){
        return await window.viewUserProfile(uid);
      }
      const user = (window.allUsers || []).find(u => String(u.uid) === uid);
      if(!user){ alert('User profile not loaded yet. Tap Find Users/Refresh once and try again.'); return; }
      const safe = window.safe || (v => String(v || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])));
      const box = document.getElementById('profileView') || document.getElementById('profileBox') || document.querySelector('#profilePage .card') || document.querySelector('[data-profile-box]');
      if(window.showTab) window.showTab('profile');
      if(box){
        box.innerHTML = `
          <div class="profile-hero" style="text-align:center;padding:18px">
            <div class="avatar big" style="margin:auto;font-size:44px">${safe(user.avatar || '👤')}</div>
            <h2>${safe(user.name || user.displayName || user.username || 'User')}</h2>
            <p>@${safe(user.username || 'user')} • ${safe(user.email || '')}</p>
            <p>${safe(user.bio || user.status || 'Hey there, I am using Kalb Message.')}</p>
            <div class="actions" style="justify-content:center">
              <button class="btn" onclick="openPrivateChat('${uid}')">Message</button>
              <button class="btn red" onclick="blockUser('${uid}')">Block</button>
            </div>
          </div>`;
      }
    }catch(e){
      console.error('openUserProfile fix error', e);
      alert('Profile opening failed: ' + (e && e.message ? e.message : e));
    }
  }
  window.openUserProfile = robustOpenProfile;
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button');
    if(!btn) return;
    const txt = (btn.textContent || '').trim().toLowerCase();
    if(txt !== 'profile' && txt !== 'view profile' && txt !== 'view') return;
    const onclick = btn.getAttribute('onclick') || '';
    const m = onclick.match(/(?:openUserProfile|viewUserProfile)\(['"]([^'"]+)['"]\)/);
    if(m && m[1]){
      e.preventDefault();
      e.stopPropagation();
      robustOpenProfile(m[1]);
    }
  }, true);
})();
