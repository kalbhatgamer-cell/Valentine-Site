
(function(){
  if(window.__kalbCorrectWallpaperFixLoaded) return;
  window.__kalbCorrectWallpaperFixLoaded=true;

  const WALLPAPERS={
    dark:'linear-gradient(135deg,#020617,#0f172a)',
    neon:'radial-gradient(circle at 18% 18%,rgba(34,211,238,.34),transparent 30%),radial-gradient(circle at 82% 82%,rgba(168,85,247,.28),transparent 34%),linear-gradient(135deg,#020617,#111827,#312e81)',
    love:'linear-gradient(135deg,#3b0826,#831843,#be185d)',
    forest:'linear-gradient(135deg,#052e16,#064e3b,#166534)',
    sunset:'linear-gradient(135deg,#431407,#9a3412,#f97316)',
    ocean:'linear-gradient(135deg,#082f49,#0369a1,#06b6d4)'
  };

  function normalizeWallpaper(value){
    const v=String(value||'').trim().toLowerCase();
    if(WALLPAPERS[v]) return v;
    if(v.includes('be185d')||v.includes('831843')) return 'love';
    if(v.includes('166534')||v.includes('064e3b')) return 'forest';
    if(v.includes('f97316')||v.includes('9a3412')) return 'sunset';
    if(v.includes('0369a1')||v.includes('082f49')) return 'ocean';
    if(v.includes('312e81')||v.includes('168,85,247')||v.includes('34,211,238')) return 'neon';
    return 'dark';
  }

  function getSavedWallpaper(){
    /* localStorage is first, so the selected card cannot be overwritten by old cloud data after refresh. */
    return normalizeWallpaper(
      localStorage.getItem('kalbChatWallpaperFixed') ||
      localStorage.getItem('kalbChatWallpaper') ||
      (window.currentUserProfile && (currentUserProfile.chatWallpaperType || currentUserProfile.chatWallpaper)) ||
      'dark'
    );
  }

  function markActive(type){
    document.querySelectorAll('.wallpaper-card').forEach(card=>card.classList.remove('active'));
    document.querySelectorAll('.chat-wallpaper-'+type).forEach(card=>card.classList.add('active'));
  }

  function paintRealChatBoxes(type){
    const bg=WALLPAPERS[type]||WALLPAPERS.dark;
    document.documentElement.style.setProperty('--kalb-chat-wallpaper-bg',bg);
    document.documentElement.style.setProperty('--chat-wallpaper-bg',bg);
    document.documentElement.style.setProperty('--chat-wallpaper',bg);
    document.body.setAttribute('data-kalb-chat-wallpaper',type);
    document.body.setAttribute('data-chat-wallpaper',type);

    const targets=document.querySelectorAll([
      '#messagesBox',
      '#groupMessagesBox',
      '#chatMessages',
      '#privateChatMessages',
      '#groupMessages',
      '.messages-box',
      '.chat-window'
    ].join(','));

    targets.forEach(el=>{
      el.classList.add('kalb-wallpaper-target');
      el.style.setProperty('background',bg,'important');
      el.style.setProperty('background-size','cover','important');
      el.style.setProperty('background-position','center','important');
      el.style.setProperty('background-attachment','local','important');
    });
    markActive(type);
  }

  window.applyKalbChatWallpaperCorrectly=function(type){
    type=normalizeWallpaper(type||getSavedWallpaper());
    paintRealChatBoxes(type);
    return type;
  };

  window.setChatWallpaperFinal=async function(type){
    type=normalizeWallpaper(type||'dark');
    localStorage.setItem('kalbChatWallpaperFixed',type);
    localStorage.setItem('kalbChatWallpaper',type);
    localStorage.setItem('kalbWallpaper',WALLPAPERS[type]);
    paintRealChatBoxes(type);

    try{
      const me=window.currentUser || (window.auth && window.auth.currentUser) || null;
      if(me && window.db && window.updateDoc && window.doc){
        await window.updateDoc(window.doc(window.db,'users',me.uid),{
          chatWallpaper:type,
          chatWallpaperType:type,
          chatWallpaperBg:WALLPAPERS[type]
        });
      }
    }catch(e){console.warn('Wallpaper saved locally. Cloud save skipped:',e);}

    return type;
  };

  window.loadChatWallpaperFinal=function(){
    return window.applyKalbChatWallpaperCorrectly(getSavedWallpaper());
  };

  window.saveChatWallpaper=function(){
    const raw=(document.getElementById('wallpaperInput')?.value||'').trim();
    if(!raw) return alert('Enter a wallpaper color or CSS background.');
    localStorage.setItem('kalbChatWallpaperFixed','custom');
    localStorage.setItem('kalbWallpaper',raw);
    document.documentElement.style.setProperty('--kalb-chat-wallpaper-bg',raw);
    document.documentElement.style.setProperty('--chat-wallpaper-bg',raw);
    document.documentElement.style.setProperty('--chat-wallpaper',raw);
    document.body.setAttribute('data-kalb-chat-wallpaper','custom');
    document.querySelectorAll('#messagesBox,#groupMessagesBox,#chatMessages,#privateChatMessages,#groupMessages,.messages-box,.chat-window').forEach(el=>{
      el.classList.add('kalb-wallpaper-target');
      el.style.setProperty('background',raw,'important');
      el.style.setProperty('background-size','cover','important');
      el.style.setProperty('background-position','center','important');
    });
    alert('Wallpaper saved.');
  };

  const oldOpenPage=window.openPage;
  if(typeof oldOpenPage==='function'){
    window.openPage=function(){
      const r=oldOpenPage.apply(this,arguments);
      setTimeout(()=>window.loadChatWallpaperFinal(),60);
      setTimeout(()=>window.loadChatWallpaperFinal(),350);
      return r;
    };
  }

  ['openChat','openPrivateChat','openChatRoom','openGroupChat','renderMessages','renderPrivateMessages','renderGroupMessages'].forEach(name=>{
    const old=window[name];
    if(typeof old==='function'){
      window[name]=function(){
        const r=old.apply(this,arguments);
        setTimeout(()=>window.loadChatWallpaperFinal(),60);
        setTimeout(()=>window.loadChatWallpaperFinal(),350);
        return r;
      };
    }
  });

  document.addEventListener('DOMContentLoaded',()=>window.loadChatWallpaperFinal());
  window.addEventListener('load',()=>window.loadChatWallpaperFinal());
  document.addEventListener('click',()=>setTimeout(()=>window.loadChatWallpaperFinal(),120),true);
  setTimeout(()=>window.loadChatWallpaperFinal(),100);
  setTimeout(()=>window.loadChatWallpaperFinal(),900);
  setInterval(()=>window.loadChatWallpaperFinal(),2500);

  try{
    let kalbWallpaperTimer=null;
    new MutationObserver(()=>{clearTimeout(kalbWallpaperTimer);kalbWallpaperTimer=setTimeout(()=>window.loadChatWallpaperFinal(),350);}).observe(document.body,{childList:true,subtree:true});
  }catch(e){}
})();
