
(function(){
  function removeBottomActivity(){
    var bars=document.querySelectorAll('#bottomNav,.bottom,.bottom-nav,.bottomTabs,.nav-bar,.tabbar');
    bars.forEach(function(bar){
      Array.from(bar.children).forEach(function(item){
        var txt=(item.innerText||item.textContent||'').trim().toLowerCase();
        var click=(item.getAttribute('onclick')||'').toLowerCase();
        if(txt.includes('activity') || click.includes('activitypage')){
          item.remove();
        }
      });
    });
  }
  document.addEventListener('DOMContentLoaded', removeBottomActivity);
  setTimeout(removeBottomActivity, 200);
  setTimeout(removeBottomActivity, 800);
  window.addEventListener('load', removeBottomActivity);
  var oldOpenPage = window.openPage;
  window.openPage = function(id, navEl){
    removeBottomActivity();
    if(typeof oldOpenPage === 'function') return oldOpenPage.apply(this, arguments);
  };
})();
