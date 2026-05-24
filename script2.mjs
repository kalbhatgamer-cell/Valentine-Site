
(function(){
  let seenKey = '';
  let seenSet = new Set();
  function getSeenKey(){
    try{return 'kalb_seen_activities_'+(window.currentUser?.uid || 'guest');}catch(e){return 'kalb_seen_activities_guest';}
  }
  function loadSeen(){
    seenKey=getSeenKey();
    try{seenSet=new Set(JSON.parse(localStorage.getItem(seenKey)||'[]'));}catch(e){seenSet=new Set();}
  }
  function saveSeen(){
    try{localStorage.setItem(seenKey, JSON.stringify(Array.from(seenSet).slice(-500)));}catch(e){}
  }
  function esc(v){return (window.safe?window.safe(v):String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])));}
  function fmt(t){return (window.formatDate?window.formatDate(t):'Just now');}
  function activityIcon(t){
    return {follow:'➕ Follow',like:'❤️ Like',comment:'💬 Comment',post:'📝 Post',story:'⚡ Story',announcement:'📢 Admin',friend:'👥 Friend',report:'🚩 Report',message:'✉️ Message'}[t] || '🔔 Activity';
  }
  function updateBottomBadge(count){
    const topB=document.getElementById('activityUnreadBubbleTop');
    if(topB){
      topB.textContent=count>99?'99+':String(count);
      topB.classList.toggle('hidden', !(count>0));
    }
    const activityNav=[...document.querySelectorAll('.nav')].find(n=>(n.textContent||'').toLowerCase().includes('activity'));
    if(activityNav){
      activityNav.style.position='relative';
      let b=document.getElementById('activityUnreadBubble');
      if(!b){b=document.createElement('span');b.id='activityUnreadBubble';activityNav.appendChild(b);}
      b.textContent=count>99?'99+':String(count);
      b.style.display=count>0?'flex':'none';
    }
  }
  function showToast(text){
    let t=document.getElementById('kalbNotifyToast');
    if(!t){t=document.createElement('div');t.id='kalbNotifyToast';t.className='notify-toast';document.body.appendChild(t);}
    t.textContent=text;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),3000);
  }
  window.enableKalbNotifications=async function(){
    if(!('Notification' in window)){alert('This browser does not support notifications.');return;}
    const p=await Notification.requestPermission();
    alert(p==='granted'?'Notifications enabled.':'Notifications not enabled.');
  };
  window.markAllActivitiesRead=function(){
    loadSeen();
    (window.allActivities||[]).forEach(a=>{if(a.id)seenSet.add(a.id)});
    saveSeen();
    if(typeof window.renderActivity==='function')window.renderActivity();
  };
  const originalRender=window.renderActivity;
  window.renderActivity=function(){
    const box=document.getElementById('activityList');
    if(!box){ if(originalRender) originalRender(); return; }
    loadSeen();
    const me=window.currentUser?.uid;
    const visible=(window.allActivities||[]).filter(a=>!a.targetUid||a.targetUid===me||a.uid===me||a.type==='announcement');
    const unread=visible.filter(a=>a.id&&!seenSet.has(a.id));
    updateBottomBadge(unread.length);
    const actions=`<div class="activity-actions"><button class="mini-btn" onclick="enableKalbNotifications()">Enable Notifications</button><button class="mini-btn warn" onclick="markAllActivitiesRead()">Mark All Read</button></div>`;
    if(!visible.length){box.innerHTML=actions+'<div class="empty">No activity yet.</div>';return;}
    box.innerHTML=actions+visible.slice(0,100).map(a=>{
      const un=a.id&&!seenSet.has(a.id);
      return `<div class="activity-item ${un?'unread':''}"><span class="activity-type">${activityIcon(a.type)}</span><b>${esc(a.actorName||'Kalb')}</b><p>${esc(a.text||'New activity')}</p><p class="muted">${fmt(a.createdAt)}</p></div>`;
    }).join('');
    if(unread.length && document.visibilityState==='visible'){
      const newest=unread[0];
      if(newest && newest.id && !sessionStorage.getItem('toast_'+newest.id)){
        sessionStorage.setItem('toast_'+newest.id,'1');
        showToast((newest.actorName||'Kalb')+': '+(newest.text||'New activity'));
      }
    }
  };
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&typeof window.renderActivity==='function')window.renderActivity(); });
  setTimeout(()=>{ if(typeof window.renderActivity==='function')window.renderActivity(); },1200);
})();
