
window.addEventListener("load",function(){setTimeout(function(){document.getElementById("loader").style.display="none"},800)});

window.addEventListener('DOMContentLoaded',()=>{try{applySavedSettings()}catch(e){console.error(e)}});
window.sendPrivateMessage=async function(){
  if(!currentUser || !selectedChatUser || !selectedChatId)return alert("Open a chat first.");
  const input=document.getElementById("privateMessageInput")||document.getElementById("messageInput")||document.getElementById("chatMessageInput");
  if(!input)return alert("Message input not found.");
  const text=(input.value||"").trim();
  if(!text)return;
  const me=currentUserProfile||{};
  await setDoc(doc(db,"chats",selectedChatId),{
    members:[currentUser.uid,selectedChatUser.uid],
    memberNames:{
      [currentUser.uid]:me.name||currentUser.displayName||currentUser.email||"User",
      [selectedChatUser.uid]:selectedChatUser.name||selectedChatUser.email||"User"
    },
    lastMessage:text,
    lastMessageAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  },{merge:true});
  await addDoc(collection(db,"chats",selectedChatId,"messages"),{
    text,
    uid:currentUser.uid,
    email:currentUser.email||"",
    name:me.name||currentUser.displayName||"User",
    createdAt:serverTimestamp()
  });
  input.value="";
  unarchiveChat(selectedChatId);
};

// Button click safety bridge
(function(){
  const names=[
    "openPage","loginEmailPassword","signupEmailPassword","loginGoogle","logout",
    "saveProfile","viewUserProfile","followUserFromFeed","toggleFollowViewedUser",
    "createPost","toggleLike","toggleComments","addComment","toggleSavePost",
    "repostPost","pinPost","editPost","deletePost","reportPost",
    "openPrivateChat","sendPrivateChat","sendPrivateMessage","sendMessage",
    "archiveChat","unarchiveChat","deleteChatLocal","deleteCurrentChat",
    "showArchivedChats","showActiveChats","requestCallToUser","startRoomCall",
    "acceptCall","rejectCall","hangupCall","toggleMic","toggleCamera",
    "createGroup","openGroupChat","sendGroupMessage","addGroupMember",
    "showUsersPage","searchUsers","setAccent","toggleOnlinePrivacy",
    "deleteAccountFull","ensureAllUsersLoadedFinal","getFriendIdsFinal","ensureAllUsersLoaded","getAcceptedFriendIds","unfriendUser","refreshSearchPage","renderFriendsList"
  ];
  names.forEach(function(n){
    try{
      if(typeof window[n]==="undefined" && typeof eval(n)==="function"){
        window[n]=eval(n);
      }
    }catch(e){}
  });
})();


// Safe comment fallback
function findCommentBoxSafe(postId){
  return document.getElementById("comments_"+postId) ||
         document.querySelector('[id^="comments_"][id$="_'+postId+'"]') ||
         document.querySelector('[data-comments-post="'+postId+'"]');
}
function findCommentBox(postId, boxKey){
  const key=boxKey?String(boxKey).replace(/[^a-zA-Z0-9_-]/g,"_"):"";
  if(key){
    const exact=document.getElementById("comments_"+key+"_"+postId);
    if(exact)return exact;
  }
  return document.getElementById("comments_"+postId) ||
         document.querySelector('[data-comments-post="'+postId+'"]') ||
         document.querySelector('[id^="comments_"][id$="_'+postId+'"]');
}

function findCommentList(postId, boxKey){
  const box=findCommentBox(postId, boxKey);
  if(!box)return null;
  return box.querySelector("[data-comment-list]") || 
         document.getElementById("commentList_"+postId) ||
         box.querySelector("div");
}

function findCommentInput(postId, boxKey){
  const box=findCommentBox(postId, boxKey);
  if(!box)return null;
  return box.querySelector("[data-comment-input]") ||
         document.getElementById("commentInput_"+postId) ||
         box.querySelector("input");
}


window.toggleComments=function(postId, boxKey){
  const box=findCommentBoxSafe(postId);
  if(!box){ alert("Comment box not found. Refresh once."); return; }
  const opening=box.classList.contains("hidden") || box.style.display==="none";
  box.classList.toggle("hidden", !opening);
  box.style.display=opening?"block":"";
  if(opening && typeof listenPostComments==="function"){
    try{ listenPostComments(postId, boxKey); }catch(e){ console.error(e); }
  }
};




window.refreshSearchPage=function(){
  if(typeof renderFriendRequests==="function")renderFriendRequests();
  if(typeof renderUsers==="function")renderUsers();
  if(typeof renderFriendsList==="function")renderFriendsList();
};












window.getFriendIdsFinal=async function(){
  if(!currentUser)return [];
  const ids=new Set();

  // 1. From current user profile array
  (currentUserProfile?.friends||[]).forEach(id=>id&&ids.add(id));

  // 2. From allUsers data where the user has me in their friends array
  try{
    await ensureAllUsersLoadedFinal();
    (allUsers||[]).forEach(u=>{
      if(u.uid!==currentUser.uid && Array.isArray(u.friends) && u.friends.includes(currentUser.uid)){
        ids.add(u.uid);
      }
    });
  }catch(e){console.log("friend reverse lookup failed",e)}

  // 3. From accepted friendRequests using common field names
  const pairs=[
    ["from",currentUser.uid,"to"],
    ["to",currentUser.uid,"from"],
    ["fromUid",currentUser.uid,"toUid"],
    ["toUid",currentUser.uid,"fromUid"],
    ["senderId",currentUser.uid,"receiverId"],
    ["receiverId",currentUser.uid,"senderId"]
  ];
  for(const [mineField,mineValue,otherField] of pairs){
    try{
      const qx=query(collection(db,"friendRequests"),where("status","==","accepted"),where(mineField,"==",mineValue));
      const sx=await getDocs(qx);
      sx.forEach(d=>{
        const r=d.data();
        if(r[otherField])ids.add(r[otherField]);
      });
    }catch(e){}
  }

  ids.delete(currentUser.uid);
  return [...ids];
};

window.ensureAllUsersLoadedFinal=async function(){
  try{
    const snap=await getDocs(collection(db,"users"));
    allUsers=[];
    snap.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
  }catch(e){
    console.log("users reload failed",e);
  }
  return allUsers||[];
};

window.renderFriendsList=async function(){
  const boxes=[document.getElementById("friendsOnlyBox"),document.getElementById("friendsListBox")].filter(Boolean);
  if(!boxes.length||!currentUser)return;
  boxes.forEach(b=>b.innerHTML='<div class="card empty">Loading accepted friends...</div>');

  await ensureAllUsersLoadedFinal();
  const ids=await getFriendIdsFinal();

  if(!ids.length){
    boxes.forEach(b=>b.innerHTML='<div class="card empty">No accepted friends found. Open Search and accept/send friend requests.</div>');
    return;
  }

  const friends=(allUsers||[]).filter(u=>ids.includes(u.uid));
  if(!friends.length){
    boxes.forEach(b=>b.innerHTML='<div class="card empty">Friends found but user profile data is missing. Tap Refresh Friends once.</div>');
    return;
  }

  const content=friends.map(u=>{
    const name=safe(u.name||u.displayName||u.email||"User");
    const uname=safe(u.username||((u.email||"user").split("@")[0])||"user");
    const avatar=safe(u.avatarEmoji||initials(u.name,u.email));
    const blocked=typeof isBlocked==="function"?isBlocked(u.uid):((currentUserProfile?.blockedUsers||[]).includes(u.uid));
    const verified=u.verified?'<span class="badge-verified">✓</span>':'';
    return `<div class="friend-card-final">
      <div class="avatar">${avatar}</div>
      <div>
        <span class="friend-main-name">${name} ${verified}</span>
        <span class="friend-sub">@${uname}</span>
        <span class="friend-sub">${safe(u.bio||"")}</span>
      </div>
      <div class="friend-actions">
        <button class="btn small" onclick='viewUserProfile("${u.uid}")'>Profile</button>
        <button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button>
        <button class="btn small red" onclick='unfriendUser("${u.uid}")'>Unfriend</button>
        ${blocked?`<button class="btn small" onclick='unblockUser("${u.uid}")'>Unblock</button>`:`<button class="btn small red" onclick='blockUser("${u.uid}")'>Block</button>`}
      </div>
    </div>`;
  }).join("");

  boxes.forEach(b=>b.innerHTML=content);
};

window.unfriendUser=async function(uid){
  if(!currentUser||!uid)return;
  if(!confirm("Remove this friend?"))return;

  try{
    await updateDoc(doc(db,"users",currentUser.uid),{friends:arrayRemove(uid)});
  }catch(e){
    console.log("remove friend from me failed",e);
  }

  try{
    await updateDoc(doc(db,"users",uid),{friends:arrayRemove(currentUser.uid)});
  }catch(e){
    console.log("remove friend from other failed",e);
  }

  const deleteAccepted=async(fieldA,valA,fieldB,valB)=>{
    try{
      const qx=query(collection(db,"friendRequests"),where("status","==","accepted"),where(fieldA,"==",valA),where(fieldB,"==",valB));
      const sx=await getDocs(qx);
      const jobs=[];
      sx.forEach(d=>jobs.push(deleteDoc(doc(db,"friendRequests",d.id))));
      await Promise.all(jobs);
    }catch(e){}
  };

  await deleteAccepted("from",currentUser.uid,"to",uid);
  await deleteAccepted("to",currentUser.uid,"from",uid);
  await deleteAccepted("fromUid",currentUser.uid,"toUid",uid);
  await deleteAccepted("toUid",currentUser.uid,"fromUid",uid);
  await deleteAccepted("senderId",currentUser.uid,"receiverId",uid);
  await deleteAccepted("receiverId",currentUser.uid,"senderId",uid);

  await loadProfile();
  await ensureAllUsersLoadedFinal();
  await renderFriendsList();
  try{renderUsers()}catch(e){}
  alert("Friend removed.");
};


/* Stable Profile Final Upgrade */
window.safeReady=function(){
  try{
    document.body.classList.add("ready");
    const loader=document.getElementById("loader");
    if(loader)loader.style.display="none";
  }catch(e){}
};
window.addEventListener("load",()=>setTimeout(window.safeReady,900));
setTimeout(window.safeReady,3500);
setTimeout(window.safeReady,6500);

window.reloadUsersForProfileFinal=async function(){
  try{
    const snap=await getDocs(collection(db,"users"));
    allUsers=[];
    snap.forEach(d=>allUsers.push({uid:d.id,...d.data()}));
  }catch(e){console.warn("users reload failed",e)}
  return allUsers||[];
};

window.profileUsersListFinal=function(ids,title){
  const list=(allUsers||[]).filter(u=>ids.includes(u.uid));
  if(!list.length)return `<div class="profile-mini-card"><div></div><div><h3>${title}</h3><p>No users yet.</p></div></div>`;
  return `<h3 style="margin-top:12px">${title}</h3>`+list.map(u=>{
    const verified=(typeof verifiedHtml==="function")?verifiedHtml(u):(u.verified?'<span class="badge-verified">✓</span>':'');
    return `<div class="profile-mini-card">
      <div class="avatar">${safe(u.avatarEmoji||initials(u.name,u.email))}</div>
      <div><h3>${safe(u.name||u.displayName||u.email||"User")} ${verified}</h3><p>@${safe(u.username||((u.email||"user").split("@")[0]))}</p></div>
      <div class="actions"><button class="btn small" onclick='viewUserProfile("${u.uid}")'>View</button><button class="btn small" onclick='openPrivateChat("${u.uid}")'>Message</button></div>
    </div>`;
  }).join("");
};

window.profilePostsListFinal=function(uid){
  const posts=(allPosts||[]).filter(p=>p.uid===uid || p.userId===uid || p.authorUid===uid);
  if(!posts.length)return `<div class="profile-user-post"><p class="muted">No posts yet.</p></div>`;
  return `<h3 style="margin-top:12px">Posts</h3>`+posts.map(p=>`
    <div class="profile-user-post">
      <p>${safe(p.text||p.content||p.caption||"")}</p>
      <p class="muted">${formatDate(p.createdAt)}</p>
    </div>
  `).join("");
};

window.showProfileSectionFinal=function(type){
  const f=document.getElementById("profileFollowersListFinal");
  const g=document.getElementById("profileFollowingListFinal");
  const p=document.getElementById("profilePostsListFinal");
  if(f)f.style.display=type==="followers"?"block":"none";
  if(g)g.style.display=type==="following"?"block":"none";
  if(p)p.style.display=type==="posts"?"block":"none";
};

window.canViewProfileFinal=function(u){
  if(!currentUser||!u)return false;
  if(u.uid===currentUser.uid)return true;
  if(typeof isAppAdmin==="function" && isAppAdmin())return true;
  if(!u.privateProfile)return true;
  const friends=Array.isArray(u.friends)?u.friends:[];
  const followers=Array.isArray(u.followers)?u.followers:[];
  return friends.includes(currentUser.uid)||followers.includes(currentUser.uid);
};

window.openMyFinalProfile=function(){
  if(!currentUser)return alert("Login first.");
  viewUserProfile(currentUser.uid);
};

window.togglePrivateProfileFinal=async function(){
  if(!currentUser)return alert("Login first.");
  const old=currentUserProfile||{};
  const next=old.privateProfile!==true;
  await setDoc(doc(db,"users",currentUser.uid),{privateProfile:next,updatedAt:serverTimestamp()},{merge:true});
  currentUserProfile={...old,privateProfile:next};
  const st=document.getElementById("profilePrivacyStatus");
  if(st)st.innerText=next?"Your profile is Private":"Your profile is Public";
  alert(next?"Profile set to Private":"Profile set to Public");
};

window.followUserFinal=async function(uid){
  if(!currentUser||!uid||uid===currentUser.uid)return;
  await setDoc(doc(db,"users",currentUser.uid),{following:arrayUnion(uid),updatedAt:serverTimestamp()},{merge:true});
  await setDoc(doc(db,"users",uid),{followers:arrayUnion(currentUser.uid),updatedAt:serverTimestamp()},{merge:true});
  await loadProfile();
  await reloadUsersForProfileFinal();
  viewUserProfile(uid);
};

window.unfollowUserFinal=async function(uid){
  if(!currentUser||!uid||uid===currentUser.uid)return;
  await setDoc(doc(db,"users",currentUser.uid),{following:arrayRemove(uid),updatedAt:serverTimestamp()},{merge:true});
  await setDoc(doc(db,"users",uid),{followers:arrayRemove(currentUser.uid),updatedAt:serverTimestamp()},{merge:true});
  await loadProfile();
  await reloadUsersForProfileFinal();
  viewUserProfile(uid);
};

window.viewUserProfile=async function(uid){
  if(!uid)return alert("User profile not found.");
  await reloadUsersForProfileFinal();
  let u=(allUsers||[]).find(x=>x.uid===uid);
  if(!u){
    try{
      const s=await getDoc(doc(db,"users",uid));
      if(s.exists())u={uid:s.id,...s.data()};
    }catch(e){}
  }
  if(!u)return alert("User not found.");
  viewedProfileUser=u;

  const isMine=uid===currentUser?.uid;
  const canView=canViewProfileFinal(u);
  const followers=Array.isArray(u.followers)?u.followers:[];
  const following=Array.isArray(u.following)?u.following:[];
  const friends=Array.isArray(u.friends)?u.friends:[];
  const myFollowing=Array.isArray(currentUserProfile?.following)?currentUserProfile.following:[];
  const followingNow=myFollowing.includes(uid)||followers.includes(currentUser?.uid);
  const posts=(allPosts||[]).filter(p=>p.uid===uid || p.userId===uid || p.authorUid===uid);
  const verified=(typeof verifiedHtml==="function")?verifiedHtml(u):(u.verified?'<span class="badge-verified">✓</span>':'');

  if(document.getElementById("viewProfileAvatar")){
    viewProfileAvatar.innerText=u.avatarEmoji||initials(u.name,u.email);
    if(typeof avatarStyle==="function")viewProfileAvatar.style.background=avatarStyle(u.avatarColor);
  }
  if(document.getElementById("viewProfileName"))viewProfileName.innerHTML=safe(u.name||u.displayName||"User")+" "+verified;
  if(document.getElementById("viewProfileUsername"))viewProfileUsername.innerText="@"+(u.username||((u.email||"user").split("@")[0]));
  if(document.getElementById("viewProfileEmail"))viewProfileEmail.innerText=u.email||"";
  if(document.getElementById("viewProfileBio"))viewProfileBio.innerText=u.bio||"No bio added.";
  if(document.getElementById("viewProfileLastSeen")){
    viewProfileLastSeen.innerText=(typeof getPrivacyAwareLastSeen==="function")?getPrivacyAwareLastSeen(u):(u.hideOnline?"Online hidden":(typeof formatLastSeen==="function"?formatLastSeen(u):""));
  }
  if(document.getElementById("viewFollowersCount"))viewFollowersCount.innerText=followers.length;
  if(document.getElementById("viewFollowingCount"))viewFollowingCount.innerText=following.length;
  if(document.getElementById("viewPostsCount"))viewPostsCount.innerText=canView?posts.length:0;
  if(document.getElementById("viewFriendsCountFinal"))viewFriendsCountFinal.innerText=friends.length;
  if(document.getElementById("viewPrivacyFinal"))viewPrivacyFinal.innerText=u.privateProfile?"Private":"Public";
  if(document.getElementById("viewJoinedFinal"))viewJoinedFinal.innerText=u.createdAt?formatDate(u.createdAt).split(",")[0]:"—";

  const note=document.getElementById("viewProfilePrivacyNote");
  if(note)note.innerHTML=!canView?`<div class="private-profile-note">This profile is private. Follow or become friends to view posts and lists.</div>`:"";

  const fl=document.getElementById("profileFollowersListFinal");
  const fg=document.getElementById("profileFollowingListFinal");
  const pp=document.getElementById("profilePostsListFinal");
  if(fl)fl.innerHTML=canView?profileUsersListFinal(followers,"Followers"):"";
  if(fg)fg.innerHTML=canView?profileUsersListFinal(following,"Following"):"";
  if(pp)pp.innerHTML=canView?profilePostsListFinal(uid):"";

  const row=document.querySelector("#viewProfilePage .profile-action-row");
  if(row){
    row.innerHTML=`
      ${isMine?`<button class="btn small" onclick="togglePrivateProfileFinal()">Toggle Privacy</button>`:""}
      ${!isMine?(followingNow?`<button id="viewFollowBtn" class="btn small red" onclick='unfollowUserFinal("${uid}")'>Unfollow</button>`:`<button id="viewFollowBtn" class="btn small green" onclick='followUserFinal("${uid}")'>Follow</button>`):""}
      ${!isMine?`<button class="btn small green" onclick='sendFriendRequest("${uid}")'>Add Friend</button>`:""}
      ${!isMine?`<button class="btn small" onclick='openPrivateChat("${uid}")'>Message</button>`:""}
      ${!isMine?`<button class="btn small green" onclick='requestCallToUser("${uid}")'>Open Call</button>`:""}
      ${!isMine?`<button class="btn small red" onclick='reportProfile("${uid}")'>Report</button>`:""}
      ${typeof isAppAdmin==="function"&&isAppAdmin()&&!isMine?`<button class="btn small" onclick='${u.verified?`unverifyUserAdmin("${uid}")`:`verifyUserAdmin("${uid}")`}'>${u.verified?"Unverify":"Verify"}</button>`:""}
    `;
  }
  showProfileSectionFinal("followers");
  openPage("viewProfilePage");
};

