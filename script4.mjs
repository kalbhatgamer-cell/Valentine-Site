
(function(){
  function fixBottomTabs(){
    var bottom=document.getElementById('bottomNav');
    if(!bottom) return;
    bottom.querySelectorAll('.nav').forEach(function(btn){
      var txt=(btn.textContent||'').toLowerCase();
      if(txt.includes('profile') || txt.includes('activity') || txt.includes('admin')) btn.remove();
    });
    bottom.style.display='grid';
    bottom.style.gridTemplateColumns='repeat(6,1fr)';
    var topActivity=document.getElementById('topActivityBtn');
    if(topActivity){
      topActivity.onclick=function(){
        if(typeof openPage==='function') openPage('activityPage');
      };
      topActivity.style.display='inline-flex';
    }
    var topProfile=document.querySelector('.avatar-top, #topProfileBtn, .profile-top');
    if(topProfile){ topProfile.style.display='inline-flex'; }
  }
  document.addEventListener('DOMContentLoaded', fixBottomTabs);
  setTimeout(fixBottomTabs, 300);
  setTimeout(fixBottomTabs, 1200);
})();
