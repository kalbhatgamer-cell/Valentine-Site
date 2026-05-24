
(function(){
  function ensureCard(){
    try{
      var settings=document.getElementById('settingsPage');
      if(!settings || document.getElementById('accountSwitcherCard')) return;
      var card=document.createElement('div');
      card.className='card account-switcher-card';
      card.id='accountSwitcherCard';
      card.innerHTML='<h2>Account Switcher</h2><p class="muted">Switch between your saved accounts on this device. Your chats, profile, calls, feed and all old features stay unchanged.</p><div class="actions"><button class="btn small green" onclick="saveCurrentAccountForSwitch()">Save Current Account</button><button class="btn small" onclick="addGoogleAccountForSwitch()">Add Google Account</button><button class="btn small" onclick="addEmailAccountForSwitch()">Add Email Account</button></div><p class="account-switch-note">Email accounts may ask for password when switching. Google accounts open Google login popup.</p><div id="accountSwitcherStatus"></div><div id="accountSwitcherList" class="account-list-box"><p class="muted">No saved accounts yet.</p></div>';
      settings.insertBefore(card, settings.firstChild);
    }catch(e){console.warn('Account switcher card fix failed',e)}
  }
  document.addEventListener('DOMContentLoaded', function(){ ensureCard(); setTimeout(function(){ if(window.renderAccountSwitcher) window.renderAccountSwitcher(); },600); });
  window.addEventListener('load', function(){ ensureCard(); setTimeout(function(){ if(window.renderAccountSwitcher) window.renderAccountSwitcher(); },900); });
})();
