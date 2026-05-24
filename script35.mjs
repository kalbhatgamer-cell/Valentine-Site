
/* KALB FINAL CHAT + ADMIN USER CONTROL PATCH
   - Restores the original working private chat opener saved from the core chat system.
   - Makes every Open / Message button resolve users by UID, Kalb ID, email, username, display name, or existing chat document.
   - Replaces Admin Users Control Message buttons with Ban / Unban buttons only.
*/
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const KALB_FIREBASE_CONFIG_CHAT_ADMIN_FIX = {
  apiKey:"AIzaSyD80d4bZpZZp0JRZeaBwQKG5GapwLJVki8",
  authDomain:"kalb-message.firebaseapp.com",
  projectId:"kalb-message",
  storageBucket:"kalb-message.firebasestorage.app",
  messagingSenderId:"139873273901",
  appId:"1:139873273901:web:c7c079d385daeb3401d0a4",
  measurementId:"G-C9S0K1SG0D"
};

const app = getApps().length ? getApps()[0] : initializeApp(KALB_FIREBASE_CONFIG_CHAT_ADMIN_FIX);
const auth = getAuth(app);
const db = getFirestore(app);
let authUserForFinalFix = auth.currentUser || null;
onAuthStateChanged(auth, user => { authUserForFinalFix = user || null; });

const cleanFinal = v => String(v || "").trim();
const lowerFinal = v => cleanFinal(v).toLowerCase();
const escFinal = v => cleanFinal(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

function getFieldFinal(u, keys){
  for(const k of keys){
    if(u && u[k] !== undefined && u[k] !== null && cleanFinal(u[k])) return cleanFinal(u[k]);
  }
  return "";
}

function userNameFinal(u){
  return getFieldFinal(u, ['displayName','name','fullName','username','email','uid','id']) || 'User';
}

function userEmailFinal(u){
  return getFieldFinal(u, ['email','mail']);
}

function userHandleFinal(u){
  const raw = getFieldFinal(u, ['username','handle','userName']);
  return raw ? raw.replace(/^@/, '') : '';
}

function userKalbIdFinal(u){
  return getFieldFinal(u, ['kalbId','kalbID','KLB','profileId','publicId']);
}

function userUidFinal(u){
  return getFieldFinal(u, ['uid','id','userId']);
}

async function allUsersFinal(){
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id:d.id, uid:d.id, ...d.data() }));
}

function extractCardNameFinal(card){
  if(!card) return '';
  const title = card.querySelector('h1,h2,h3,h4,strong,b,.name,.user-name,.chat-name,.profile-name');
  if(title && cleanFinal(title.textContent)) return cleanFinal(title.textContent);
  const clone = card.cloneNode(true);
  clone.querySelectorAll('button,input,select,textarea').forEach(n => n.remove());
  return cleanFinal((clone.textContent || '').split('\n').map(x => cleanFinal(x)).filter(Boolean)[0] || '');
}

function chatMembersFinal(data, fallbackId){
  const arrs = [data?.memberIds, data?.members, data?.participants, data?.participantIds, data?.users, data?.userIds];
  for(const arr of arrs){
    if(Array.isArray(arr) && arr.length >= 2) return arr.map(cleanFinal).filter(Boolean);
  }
  const pairKeys = ['uid1','uid2','from','to','senderId','receiverId','ownerId','targetUid','user1','user2'];
  const vals = pairKeys.map(k => cleanFinal(data?.[k])).filter(Boolean);
  if(vals.length >= 2) return [...new Set(vals)];
  const id = cleanFinal(fallbackId);
  if(id.includes('_')) return id.split('_').map(cleanFinal).filter(Boolean);
  return [];
}

async function resolveUserFinal(rawInput, nameInput, emailInput){
  const raw = cleanFinal(rawInput);
  const name = cleanFinal(nameInput);
  const email = cleanFinal(emailInput);
  const candidates = [raw, name, email].filter(Boolean);
  const candidateLower = candidates.map(lowerFinal);

  // 1) Existing chat document -> use the other member UID.
  if(raw){
    try{
      const cdoc = await getDoc(doc(db, 'chats', raw));
      if(cdoc.exists()){
        const members = chatMembersFinal(cdoc.data(), raw);
        const me = authUserForFinalFix?.uid || '';
        const peer = members.find(x => x && x !== me) || members[0];
        if(peer) return { uid:peer, chatId:raw, source:'chatDoc' };
      }
    }catch(e){}
  }

  const users = await allUsersFinal();
  const byExact = users.find(u => {
    const values = [
      u.id,
      userUidFinal(u),
      userEmailFinal(u),
      userHandleFinal(u),
      '@' + userHandleFinal(u),
      userNameFinal(u),
      userKalbIdFinal(u)
    ].filter(Boolean).map(lowerFinal);
    return candidateLower.some(c => c && values.includes(c));
  });
  if(byExact) return { uid:userUidFinal(byExact) || byExact.id, user:byExact, source:'exactUser' };

  const byLoose = users.find(u => {
    const nm = lowerFinal(userNameFinal(u));
    const handle = lowerFinal(userHandleFinal(u));
    const em = lowerFinal(userEmailFinal(u));
    return candidateLower.some(c => c && (nm === c || handle === c || em === c || nm.includes(c) || c.includes(nm)));
  });
  if(byLoose) return { uid:userUidFinal(byLoose) || byLoose.id, user:byLoose, source:'looseUser' };

  // Last fallback: if the raw value looks like a UID, try it directly.
  if(raw && !raw.includes(' ') && raw.length >= 8) return { uid:raw, source:'rawUidFallback' };
  return null;
}

async function openChatFinalFixed(rawInput, nameInput, emailInput){
  const result = await resolveUserFinal(rawInput, nameInput, emailInput);
  const uid = result?.uid;
  if(!uid){
    alert('User not found.');
    return false;
  }
  if(typeof window.__kalbCoreOpenPrivateChat === 'function'){
    await window.__kalbCoreOpenPrivateChat(uid);
    return true;
  }
  // Fallback only if the core opener was not available.
  if(typeof window.showPage === 'function') window.showPage('chatRoomPage');
  else if(typeof window.openPage === 'function') window.openPage('chatRoomPage');
  const title = document.getElementById('roomTitle');
  if(title) title.textContent = result?.user ? userNameFinal(result.user) : (nameInput || 'Chat');
  return true;
}

window.openPrivateChat = openChatFinalFixed;
window.messageUser = openChatFinalFixed;
window.kalbOpenChatFromList = openChatFinalFixed;
window.kalbOpenExistingChatFixed = openChatFinalFixed;

function looksLikeChatOpenButtonFinal(btn){
  const txt = lowerFinal(btn.textContent);
  if(txt === 'open'){
    const areaText = lowerFinal((btn.closest('.page,section,main,body') || document.body).textContent).slice(0, 3000);
    return areaText.includes('recent chats are sorted') || areaText.includes('active chats') || areaText.includes('archived chats');
  }
  if(txt === 'message'){
    const areaText = lowerFinal((btn.closest('.page,section,main,body') || document.body).textContent).slice(0, 3000);
    return areaText.includes('search users') || areaText.includes('find users') || areaText.includes('my friends') || areaText.includes('requests');
  }
  return false;
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn || !looksLikeChatOpenButtonFinal(btn)) return;
  const card = btn.closest('[data-fixed-chat-id],[data-chat-id],[data-open-uid],[data-uid],.chat-card,.user-card,.mini-card,.card,li,article');
  if(!card) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const raw = card.getAttribute('data-open-uid') || card.getAttribute('data-uid') || card.getAttribute('data-user-id') || card.getAttribute('data-fixed-chat-id') || card.getAttribute('data-chat-id') || '';
  const name = extractCardNameFinal(card);
  const emailNode = [...card.querySelectorAll('*')].find(n => /@/.test(n.textContent || '') && !/message|open|archive|delete/i.test(n.textContent || ''));
  const email = emailNode ? cleanFinal(emailNode.textContent).split(/\s+/).find(x => x.includes('@')) : '';
  await openChatFinalFixed(raw, name, email);
}, true);

async function toggleBanFinal(uid, makeBanned){
  if(!uid) return;
  await setDoc(doc(db, 'users', uid), {
    banned: !!makeBanned,
    banStatus: makeBanned ? 'banned' : 'active',
    updatedAt: serverTimestamp()
  }, { merge:true });
}

function findUsersControlBoxFinal(){
  const headings = [...document.querySelectorAll('h1,h2,h3,h4')];
  const h = headings.find(x => lowerFinal(x.textContent).includes('users control'));
  if(!h) return null;
  return h.closest('.card,.panel,.section,.settings-card,.glass,section,div') || h.parentElement;
}

async function renderAdminUsersBanControlFinal(force=false){
  const box = findUsersControlBoxFinal();
  if(!box) return;
  if(box.dataset.kalbBanControlFixed === '1' && !force) return;
  box.dataset.kalbBanControlFixed = '1';
  box.innerHTML = `
    <h2>Users Control</h2>
    <p class="muted">Admin can ban or unban users. All users are loaded here.</p>
    <input id="kalbAdminUserSearchFinal" class="input" placeholder="Search user / UID / email / Kalb ID" style="width:100%;margin:10px 0 14px;padding:14px;border-radius:18px;">
    <div id="kalbAdminUsersBanListFinal" class="list"><p class="muted">Loading users...</p></div>
  `;
  const list = box.querySelector('#kalbAdminUsersBanListFinal');
  const search = box.querySelector('#kalbAdminUserSearchFinal');
  let users = [];
  try{
    users = await allUsersFinal();
  }catch(err){
    list.innerHTML = `<p class="muted">Unable to load users.</p>`;
    return;
  }
  function draw(){
    const q = lowerFinal(search.value);
    const filtered = users.filter(u => {
      const text = lowerFinal([userNameFinal(u), userHandleFinal(u), userEmailFinal(u), userKalbIdFinal(u), u.id].join(' '));
      return !q || text.includes(q);
    });
    if(!filtered.length){
      list.innerHTML = `<p class="muted">No users found.</p>`;
      return;
    }
    list.innerHTML = filtered.map(u => {
      const uid = escFinal(userUidFinal(u) || u.id);
      const banned = !!(u.banned || lowerFinal(u.banStatus) === 'banned' || lowerFinal(u.status) === 'banned');
      const name = escFinal(userNameFinal(u));
      const handle = escFinal(userHandleFinal(u));
      const email = escFinal(userEmailFinal(u));
      const kid = escFinal(userKalbIdFinal(u));
      return `
        <div class="mini-card kalb-admin-user-row" data-admin-user-uid="${uid}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0;padding:14px;border-radius:20px;">
          <div style="min-width:0;">
            <h3 style="margin:0 0 4px;">${name}</h3>
            <p class="muted" style="margin:0;word-break:break-word;">@${handle || 'user'}${kid ? ' · ID: '+kid : ''}${email ? ' · '+email : ''}</p>
            <p style="margin:6px 0 0;color:${banned ? '#ff7777' : '#66ffd6'};">${banned ? 'Banned' : 'Active'}</p>
          </div>
          <button class="btn ${banned ? 'good' : 'danger'} kalb-ban-toggle-btn" data-ban-next="${banned ? '0' : '1'}">${banned ? 'Unban' : 'Ban'}</button>
        </div>`;
    }).join('');
  }
  search.addEventListener('input', draw);
  list.addEventListener('click', async e => {
    const btn = e.target.closest('.kalb-ban-toggle-btn');
    if(!btn) return;
    const row = btn.closest('[data-admin-user-uid]');
    const uid = row?.getAttribute('data-admin-user-uid');
    const makeBanned = btn.getAttribute('data-ban-next') === '1';
    btn.disabled = true;
    btn.textContent = makeBanned ? 'Banning...' : 'Unbanning...';
    try{
      await toggleBanFinal(uid, makeBanned);
      const u = users.find(x => (userUidFinal(x) || x.id) === uid);
      if(u){ u.banned = makeBanned; u.banStatus = makeBanned ? 'banned' : 'active'; }
      draw();
    }catch(err){
      alert('Unable to update user ban status.');
      btn.disabled = false;
      draw();
    }
  });
  draw();
}

window.renderAdminUsersBanControlFinal = renderAdminUsersBanControlFinal;
setTimeout(() => renderAdminUsersBanControlFinal(true), 800);
setTimeout(() => renderAdminUsersBanControlFinal(true), 2500);
document.addEventListener('click', () => setTimeout(() => renderAdminUsersBanControlFinal(false), 250), true);
