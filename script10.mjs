
(function(){
  const BG={
    dark:'linear-gradient(135deg,#020617,#0f172a)',
    neon:'radial-gradient(circle at 20% 20%,rgba(34,211,238,.25),transparent 32%),radial-gradient(circle at 80% 80%,rgba(168,85,247,.18),transparent 36%),#020617',
    love:'linear-gradient(135deg,#3b0826,#831843,#be185d)',
    forest:'linear-gradient(135deg,#052e16,#064e3b,#166534)',
    sunset:'linear-gradient(135deg,#431407,#9a3412,#f97316)',
    ocean:'linear-gradient(135deg,#082f49,#0369a1,#06b6d4)'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const userList=()=>Array.isArray(window.allUsers)?window.allUsers:[];
  const uidOf=u=>String(u?.uid||u?.id||u?.userId||u?.docId||'');
  function makeKalbId(uid){
    let h=0, str=String(uid||Math.random());
    for(let i=0;i<str.length;i++) h=((h<<5)-h+str.charCodeAt(i))|0;
    return 'KLB-'+String(Math.abs(h)).padStart(6,'0').slice(0,6);
  }
  function kalbIdOf(u){return String(u?.kalbId||u?.profileId||u?.publicId||u?.shortId||makeKalbId(uidOf(u))).toUpperCase();}
  async function saveMissingIds(){
    try{
      if(typeof db==='undefined'||typeof updateDoc!=='function'||typeof doc!=='function') return;
      userList().forEach(u=>{
        const uid=uidOf(u); if(!uid||u.kalbId||u.profileId||u.publicId||u.shortId) return;
        const kid=makeKalbId(uid); u.kalbId=kid;
        updateDoc(doc(db,'users',uid),{kalbId:kid}).catch(()=>{});
      });
    }catch(e){}
  }
  function findUserByAnyId(value){
    const v=String(value||'').trim().toLowerCase();
    return userList().find(u=>[uidOf(u),kalbIdOf(u),u.email,u.username,u.name,u.displayName].filter(Boolean).map(x=>String(x).toLowerCase()).includes(v));
  }
  function buildBadgePicker(){
    const input=document.getElementById('badgeUserIdInput');
    if(!input) return;
    input.placeholder='Select user below or enter Kalb ID / UID / email';
    let picker=document.getElementById('badgeUserPicker');
    if(!picker){
      picker=document.createElement('select'); picker.id='badgeUserPicker';
      picker.innerHTML='<option value="">Select user by Kalb ID</option>';
      input.insertAdjacentElement('afterend',picker);
      picker.addEventListener('change',()=>{ input.value=picker.value; });
    }
    const users=userList().filter(u=>uidOf(u));
    picker.innerHTML='<option value="">Select user by Kalb ID</option>'+users.map(u=>{
      const name=u.name||u.displayName||u.username||(u.email?String(u.email).split('@')[0]:'User');
      return `<option value="${esc(kalbIdOf(u))}">${esc(name)} — ${esc(kalbIdOf(u))}</option>`;
    }).join('');
  }
  function showIdsOnProfiles(){
    userList().forEach(u=>{
      const uid=uidOf(u); if(!uid) return;
      document.querySelectorAll(`[data-user-uid="${CSS.escape(uid)}"]`).forEach(card=>{
        if(card.querySelector('.kalb-id-line')) return;
        const holder=card.querySelector('.user-info,.user-details,[style*="flex:1"],div')||card;
        holder.insertAdjacentHTML('beforeend',`<div class="kalb-id-line">ID: ${esc(kalbIdOf(u))}</div>`);
      });
    });
    const vp=document.getElementById('viewProfileEmail')||document.getElementById('profileEmail');
    const uid=window.viewingProfileUid||window.selectedProfileUid||window.currentViewedUid||uidOf(window.currentUserProfile||{});
    const u=userList().find(x=>uidOf(x)===uid)||(window.currentUserProfile||{});
    if(vp && u && !document.getElementById('visibleKalbIdLine')) vp.insertAdjacentHTML('afterend',`<p id="visibleKalbIdLine" class="kalb-id-line">ID: ${esc(kalbIdOf(u))}</p>`);
  }
  async function resolveBadgeTarget(){
    const raw=document.getElementById('badgeUserIdInput')?.value||document.getElementById('badgeUserPicker')?.value||'';
    const u=findUserByAnyId(raw);
    return u?uidOf(u):String(raw).trim();
  }
  const oldAdd=window.adminAddBadgeFinal;
  window.adminAddBadgeFinal=async function(){
    if(typeof isAppAdmin==='function'&&!isAppAdmin() && !(window.currentUserProfile&&(currentUserProfile.role==='admin'||currentUserProfile.admin===true))) return alert('Admin only.');
    const uid=await resolveBadgeTarget();
    const badge=document.getElementById('badgeTypeInput')?.value;
    if(!uid||!badge) return alert('Select a user or enter Kalb ID.');
    const user=userList().find(u=>uidOf(u)===uid)||{};
    const badges=Array.isArray(user.badges)?[...user.badges]:[];
    if(!badges.includes(badge)) badges.push(badge);
    const data={badges}; if(badge==='verified')data.verified=true; if(badge==='creator')data.creator=true; if(badge==='moderator')data.moderator=true; if(badge==='banned')data.banned=true;
    await updateDoc(doc(db,'users',uid),data); alert('Badge added.');
  };
  window.adminRemoveBadgeFinal=async function(){
    if(typeof isAppAdmin==='function'&&!isAppAdmin() && !(window.currentUserProfile&&(currentUserProfile.role==='admin'||currentUserProfile.admin===true))) return alert('Admin only.');
    const uid=await resolveBadgeTarget();
    const badge=document.getElementById('badgeTypeInput')?.value;
    if(!uid||!badge) return alert('Select a user or enter Kalb ID.');
    const user=userList().find(u=>uidOf(u)===uid)||{};
    const badges=(Array.isArray(user.badges)?user.badges:[]).filter(x=>x!==badge);
    const data={badges}; if(badge==='verified')data.verified=false; if(badge==='creator')data.creator=false; if(badge==='moderator')data.moderator=false; if(badge==='banned')data.banned=false;
    await updateDoc(doc(db,'users',uid),data); alert('Badge removed.');
  };
  const oldSet=window.setChatWallpaperFinal;
  window.setChatWallpaperFinal=async function(type){
    type=type||'dark';
    document.body.setAttribute('data-chat-wallpaper',type);
    document.documentElement.style.setProperty('--chat-wallpaper-bg',BG[type]||BG.dark);
    document.documentElement.style.setProperty('--chat-wallpaper',BG[type]||BG.dark);
    localStorage.setItem('kalbChatWallpaper',type); localStorage.setItem('kalbWallpaper',BG[type]||BG.dark);
    document.querySelectorAll('.wallpaper-card').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.chat-wallpaper-'+type).forEach(x=>x.classList.add('active'));
    try{const me=window.currentUser||(window.auth&&auth.currentUser); if(me&&typeof db!=='undefined') await updateDoc(doc(db,'users',me.uid),{chatWallpaper:type});}catch(e){}
  };
  window.loadChatWallpaperFinal=function(){
    const saved=(window.currentUserProfile&&currentUserProfile.chatWallpaper)||localStorage.getItem('kalbChatWallpaper')||'dark';
    window.setChatWallpaperFinal(BG[saved]?saved:'dark');
  };
  function tick(){saveMissingIds();buildBadgePicker();showIdsOnProfiles();if(window.loadChatWallpaperFinal)window.loadChatWallpaperFinal();}
  setTimeout(tick,800); setInterval(tick,3500);
  document.addEventListener('click',()=>setTimeout(tick,250),true);
})();
