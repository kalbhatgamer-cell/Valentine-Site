
window.addEventListener('load',()=>{
  setTimeout(async()=>{
    try{
      if(typeof db==='undefined' || !window.firebaseUserLoaded) return;
    }catch(e){}
    try{ scrubBadVisibleNamesFinal(); }catch(e){}
  },2500);
});
