
(function(){
  const BOT_KEY='kalb_bot_assistant_history_v1';
  const now=()=>new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const welcome=()=>{
    const name=(window.currentUserProfile&&window.currentUserProfile.name)||'friend';
    return `Hi ${name}! 👋
I am Kalb Bot Assistant. I can help with chats, coins, rewards, games, badges, privacy, channels, groups, themes, and account switching.

Tap a quick button or type your question.`;
  };
  const tips=[
    'Use Copy Kalb ID / QR profile to share your account faster.',
    'Buy premium rewards with Kalb Coins before using premium badges or themes.',
    'Keep Secret Chat on when you want disappearing messages.',
    'Use Block/Unblock from privacy tools if someone disturbs you.',
    'Games can give coins: Tic Tac Toe, Quiz, and Truth or Dare rewards are active.',
    'Channels are best for announcements. Public groups are best for community chat.',
    'Account Switcher saves accounts on this device only, so keep your device safe.'
  ];
  function response(q){
    const s=String(q||'').toLowerCase();
    if(!s.trim())return 'Ask me anything about Kalb Message features.';
    if(s.includes('coin')||s.includes('reward')||s.includes('wallet')||s.includes('leaderboard'))return `🪙 Kalb Coins Guide:
• Claim Daily Coins from Settings → Kalb Coins Wallet.
• Earn coins from games when rewards are active.
• Use coins to buy premium rewards.
• Rewards must be bought first before using locked badges/themes.
• Leaderboard shows top coin users.`;
    if(s.includes('game')||s.includes('tic')||s.includes('quiz')||s.includes('truth')||s.includes('dare'))return `🎮 Games Guide:
• Games Hub is on the Dashboard.
• Tic Tac Toe and Quiz are playable.
• Truth or Dare has answer submit, I Did It, and Skip.
• Bot modes: Normal, Hard, Insane.
• Some game actions can reward Kalb Coins.`;
    if(s.includes('badge')||s.includes('verified')||s.includes('creator')||s.includes('gamer')||s.includes('pro'))return `🏷️ Badge Guide:
• Admin can add/remove official badges from Admin Panel.
• Premium badges from Rewards Store need to be bought first.
• Use Kalb ID to find users safely.
• Full email is hidden for privacy.`;
    if(s.includes('privacy')||s.includes('block')||s.includes('unblock')||s.includes('last seen')||s.includes('online')||s.includes('email'))return `🔐 Privacy Guide:
• Online status can show Online, Last seen, or Hidden by privacy.
• Blocked users cannot message/call you.
• Unblock users from the blocked users section.
• Emails are masked so others cannot see the full email.`;
    if(s.includes('chat')||s.includes('message')||s.includes('secret')||s.includes('disappear')||s.includes('wallpaper'))return `💬 Chat Guide:
• Use message search inside chat to find old messages.
• Chat wallpaper changes the chat background.
• Secret Chat Mode works with disappearing messages.
• Disappearing options can remove messages after the selected time.`;
    if(s.includes('call')||s.includes('video')||s.includes('voice'))return `📞 Call Guide:
• Voice/video calls work best when both users stay on the call page.
• Allow microphone/camera permission in the browser.
• Calls are friend-focused to reduce spam.`;
    if(s.includes('channel')||s.includes('broadcast'))return `📢 Channels Guide:
• Channels are for broadcast updates like Telegram.
• Users can create/follow channels and read announcements.
• Good for creators, admins, gaming, and study updates.`;
    if(s.includes('group')||s.includes('public')||s.includes('discover')||s.includes('trending'))return `🌍 Public Group Discovery:
• Users can discover public groups.
• Categories can include Gaming, Study, Local, and Trending.
• Public discovery helps users find communities.`;
    if(s.includes('theme')||s.includes('market')||s.includes('amoled')||s.includes('anime'))return `🎨 Theme Marketplace:
• Go to Theme/Settings area.
• Install/apply free or premium themes.
• Premium themes from Rewards Store must be bought first.`;
    if(s.includes('account')||s.includes('switch')||s.includes('login'))return `👥 Account Switcher:
• Save current account from Settings.
• Add another account and switch from the list.
• Saved accounts are kept on this device/browser only.
• Switching should not change old features.`;
    if(s.includes('admin')||s.includes('ban')||s.includes('report')||s.includes('control'))return `🛡️ Admin Help:
• Admin can control badges, users, reports, coins, and announcements.
• Use Kalb ID/name/email search where available.
• Admin-only tools are visible only to the owner/admin account.`;
    if(s.includes('rule')||s.includes('safe')||s.includes('spam'))return `📜 Kalb Rules:
• Do not spam users.
• Do not harass or abuse anyone.
• Report fake/spam accounts.
• Keep your account safe and do not share your password.`;
    if(s.includes('update')||s.includes('new'))return '✨ Current big systems include: Games Hub, Channels, Public Groups, Theme Marketplace, Secret Chat, Disappearing Messages, Profile QR, Invite/Referral, Kalb Coins, Rewards Store, and this Bot Assistant.';
    if(s.includes('help')||s.includes('what can you do'))return 'I can explain: coins, rewards, games, badges, privacy, chats, calls, channels, groups, themes, account switcher, and admin tools. Try typing “coins” or “privacy”.';
    if(s.includes('tip'))return '💡 Tip: '+tips[Math.floor(Math.random()*tips.length)];
    return 'I understood your question, but I am a free rule-based bot. Try keywords like: coins, games, badges, privacy, chat, call, channels, groups, themes, account switcher, admin, or rules.';
  }
  function load(){try{return JSON.parse(localStorage.getItem(BOT_KEY)||'[]')}catch(e){return []}}
  function save(h){try{localStorage.setItem(BOT_KEY,JSON.stringify(h.slice(-80)))}catch(e){}}
  function ensure(){let h=load(); if(!h.length){h=[{from:'bot',text:welcome(),time:now()}]; save(h)} return h;}
  function render(){
    const box=document.getElementById('kalbBotChat'); if(!box)return;
    const h=ensure();
    box.innerHTML=h.map(m=>`<div class="kalb-bot-msg ${m.from==='me'?'me':'bot'}"><b>${m.from==='me'?'You':'Kalb Bot'}</b>${esc(m.text)}<div class="kalb-bot-meta">${esc(m.time||'')}</div></div>`).join('');
    box.scrollTop=box.scrollHeight;
  }
  function push(from,text){const h=ensure(); h.push({from,text,time:now()}); save(h); render();}
  window.openKalbBotAssistant=function(){
    try{ if(typeof window.openPage==='function') window.openPage('kalbBotPage'); else document.getElementById('kalbBotPage')?.classList.add('active'); }catch(e){}
    setTimeout(render,60);
  };
  window.kalbBotAsk=function(){
    const input=document.getElementById('kalbBotInput'); if(!input)return;
    const q=(input.value||'').trim(); if(!q)return;
    input.value=''; push('me',q); setTimeout(()=>push('bot',response(q)),220);
  };
  window.kalbBotQuick=function(topic){
    const labels={help:'help',coins:'coins',games:'games',badges:'badges',privacy:'privacy',channels:'channels',rules:'rules',tips:'tip',updates:'updates',admin:'admin'};
    const q=labels[topic]||topic||'help';
    push('me',q); setTimeout(()=>push('bot',response(q)),180);
  };
  window.kalbBotClear=function(){
    if(!confirm('Clear Kalb Bot chat history on this device?'))return;
    localStorage.removeItem(BOT_KEY); render();
  };
  document.addEventListener('DOMContentLoaded',()=>{ensure(); render();});
  window.addEventListener('load',()=>setTimeout(render,500));
})();
