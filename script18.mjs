
(function(){
  var botState={game:'Tic Tac Toe',level:'Normal',board:Array(9).fill(''),turn:'X',scores:{user:0,bot:0,draw:0},quiz:null,truthCurrent:null,truthHistory:[]}; try{botState.truthHistory=JSON.parse(localStorage.getItem('kalbTruthDareHistory')||'[]')||[];}catch(e){botState.truthHistory=[];}
  var quizQuestions=[
    {q:'What does HTML mainly create?',a:['Website structure','Phone battery','WiFi password','Game controller'],c:0},
    {q:'Which one is used for styling a website?',a:['CSS','SMS','PDF','CPU'],c:0},
    {q:'Firebase is mainly used here for?',a:['Database/Auth/Storage','Changing screen glass','Charging phone','Editing photos only'],c:0},
    {q:'Vercel gives your site?',a:['Hosting with HTTPS','Free mobile data','Phone calls','Bluetooth'],c:0},
    {q:'Kalb ID should be?',a:['Unique for every user','Same for all users','Changed every refresh','Empty'],c:0}
  ];
  var truthData={
    Normal:{
      truth:['Tell one funny thing that happened today.','What is your favorite game?','Who is your best friend in this app?','What is one thing you like about Kalb Message?'],
      dare:['Do 5 claps and say Kalb Message.','Send a nice message to a friend.','Change your emoji mood for 1 minute.','Type a funny sentence in the chat.']
    },
    Hard:{
      truth:['Tell one secret hobby.','Say one thing you want to improve.','What is your most used app?','Tell one honest compliment for another player.'],
      dare:['Act like a robot for 10 seconds.','Send a random emoji message.','Say a dramatic movie dialogue.','Let the bot choose your next challenge.']
    },
    Insane:{
      truth:['Tell your most embarrassing gaming moment.','What is one challenge you failed but still remember?','Tell your boldest app idea.','What is your funniest chat mistake?'],
      dare:['Let the other player choose your profile emoji for 1 minute.','Do a 15 second funny challenge.','Type a message using only emojis.','Say Kalb Message like a movie trailer.']
    }
  };
  function getStatusBox(){ return document.getElementById('gamesHubStatus'); }
  function setStatus(html){ var box=getStatusBox(); if(!box) return; box.classList.add('active'); box.innerHTML=html; }
  function esc(v){ return String(v||'').replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function levelButtons(game){ return '<div class="games-level-row"><button class="btn small green" onclick="kalbStartBotGame(\''+esc(game)+'\',\'Normal\')">Normal Bot</button><button class="btn small" onclick="kalbStartBotGame(\''+esc(game)+'\',\'Hard\')">Hard Bot</button><button class="btn small red" onclick="kalbStartBotGame(\''+esc(game)+'\',\'Insane\')">Insane Bot</button></div>'; }
  window.kalbShowGamesHub=function(){ var section=document.getElementById('dashboardGamesHubSection'); if(section) section.scrollIntoView({behavior:'smooth',block:'start'}); };
  window.kalbSelectGame=function(game){
    botState.game=game;
    setStatus('<div class="games-bot-panel"><div class="games-bot-head"><h3>🎮 '+esc(game)+'</h3><span class="bot-tag">Bot Mode Ready</span></div><p class="games-mini-note">Choose a bot level and play from the Dashboard. Create Room still works for friend invite codes.</p>'+levelButtons(game)+'</div>');
  };
  window.kalbCreateGameRoom=function(game){
    var code='KALB-'+Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Date.now().toString().slice(-4);
    try{ localStorage.setItem('kalbLastGameRoom', JSON.stringify({game:game,code:code,createdAt:Date.now()})); }catch(e){}
    setStatus('<b>'+esc(game)+' room created:</b> <span class="games-room-code" id="lastGameRoomCode">'+esc(code)+'</span> <button class="btn small" style="margin-left:8px;margin-top:0" onclick="kalbCopyLastGameRoom()">Copy Code</button><p class="games-mini-note">Share this code with a friend. Bot mode is also available from Open.</p>');
  };
  window.kalbCopyLastGameRoom=function(){
    var el=document.getElementById('lastGameRoomCode'); var code=el?el.textContent:''; if(!code) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(function(){ setStatus('Game room code copied: <span class="games-room-code">'+esc(code)+'</span>'); }).catch(function(){ setStatus('Copy this room code: <span class="games-room-code">'+esc(code)+'</span>'); });
    }else{ setStatus('Copy this room code: <span class="games-room-code">'+esc(code)+'</span>'); }
  };
  window.kalbStartBotGame=function(game,level){
    botState.game=game; botState.level=level;
    if(game==='Tic Tac Toe') return startTic(level);
    if(game==='Quiz') return startQuiz(level);
    if(game==='Truth or Dare') return startTruth(level);
    return startPractice(game,level);
  };
  function header(game,level){ return '<div class="games-bot-panel"><div class="games-bot-head"><h3>'+esc(game)+' vs '+esc(level)+' Bot</h3><span class="bot-tag">'+esc(level)+'</span></div>'; }
  function scoreHtml(){ return '<div class="bot-score-row"><div class="bot-score-card"><b>'+botState.scores.user+'</b><span>You</span></div><div class="bot-score-card"><b>'+botState.scores.bot+'</b><span>Bot</span></div><div class="bot-score-card"><b>'+botState.scores.draw+'</b><span>Draw</span></div></div>'; }
  function startTic(level){ botState.board=Array(9).fill(''); botState.turn='X'; renderTic('Your turn. You are X.'); }
  function renderTic(msg){
    var cells=botState.board.map(function(v,i){return '<button class="tic-bot-cell" '+(v?'disabled':'')+' onclick="kalbTicMove('+i+')">'+esc(v)+'</button>';}).join('');
    setStatus(header('Tic Tac Toe',botState.level)+scoreHtml()+'<p class="games-mini-note">'+esc(msg||'')+'</p><div class="tic-bot-board">'+cells+'</div><div class="games-level-row"><button class="btn small" onclick="kalbStartBotGame(\'Tic Tac Toe\',\''+esc(botState.level)+'\')">Restart</button><button class="btn small green" onclick="kalbSelectGame(\'Tic Tac Toe\')">Change Level</button></div></div>');
  }
  var wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function winner(b){ for(var k=0;k<wins.length;k++){var w=wins[k]; if(b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[1]]===b[w[2]]) return b[w[0]];} return b.every(Boolean)?'D':''; }
  function empty(b){ return b.map(function(v,i){return v?'':i}).filter(function(v){return v!=='';}); }
  window.kalbTicMove=function(i){
    if(botState.board[i] || winner(botState.board)) return;
    botState.board[i]='X';
    var w=winner(botState.board); if(w) return finishTic(w);
    setTimeout(function(){ botMove(); var w2=winner(botState.board); if(w2) finishTic(w2); else renderTic('Your turn.'); },220);
    renderTic('Bot is thinking...');
  };
  function botMove(){ var b=botState.board, level=botState.level; var move;
    if(level==='Normal') move=randomMove(b);
    else if(level==='Hard') move=findWinBlock(b,'O') ?? findWinBlock(b,'X') ?? preferMove(b);
    else move=bestMove(b);
    if(move!==undefined && move!==null) b[move]='O';
  }
  function randomMove(b){ var e=empty(b); return e[Math.floor(Math.random()*e.length)]; }
  function findWinBlock(b,p){ for(var i of empty(b)){ var c=b.slice(); c[i]=p; if(winner(c)===p) return i; } return null; }
  function preferMove(b){ if(!b[4]) return 4; var corners=[0,2,6,8].filter(function(i){return !b[i]}); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; return randomMove(b); }
  function bestMove(b){ var best=-Infinity, move=randomMove(b); for(var i of empty(b)){ var c=b.slice(); c[i]='O'; var val=minimax(c,false); if(val>best){best=val; move=i;} } return move; }
  function minimax(b,isMax){ var w=winner(b); if(w==='O') return 10; if(w==='X') return -10; if(w==='D') return 0; if(isMax){ var best=-Infinity; for(var i of empty(b)){var c=b.slice(); c[i]='O'; best=Math.max(best,minimax(c,false));} return best;} else { var best2=Infinity; for(var j of empty(b)){var d=b.slice(); d[j]='X'; best2=Math.min(best2,minimax(d,true));} return best2;} }
  function finishTic(w){ if(w==='X'){botState.scores.user++; renderTic('You won! 🎉');} else if(w==='O'){botState.scores.bot++; renderTic('Bot won this round.');} else {botState.scores.draw++; renderTic('Draw game.');} }
  function startQuiz(level){ botState.quiz={idx:0,user:0,bot:0,level:level}; renderQuiz(); }
  function renderQuiz(){ var q=quizQuestions[botState.quiz.idx]; if(!q){ return finishQuiz(); } var opts=q.a.map(function(t,i){return '<button class="btn small" onclick="kalbQuizAnswer('+i+')">'+esc(t)+'</button>';}).join(''); setStatus(header('Quiz',botState.level)+'<p class="games-mini-note"><b>Question '+(botState.quiz.idx+1)+'/'+quizQuestions.length+':</b> '+esc(q.q)+'</p><div class="bot-score-row"><div class="bot-score-card"><b>'+botState.quiz.user+'</b><span>You</span></div><div class="bot-score-card"><b>'+botState.quiz.bot+'</b><span>Bot</span></div><div class="bot-score-card"><b>'+botState.level+'</b><span>Level</span></div></div><div class="quiz-bot-options">'+opts+'</div></div>'); }
  window.kalbQuizAnswer=function(i){ var q=quizQuestions[botState.quiz.idx]; if(i===q.c) botState.quiz.user++; var chance=botState.level==='Normal'?.4:botState.level==='Hard'?.7:.92; if(Math.random()<chance) botState.quiz.bot++; botState.quiz.idx++; renderQuiz(); };
  function finishQuiz(){ var res=botState.quiz.user>botState.quiz.bot?'You win! 🎉':botState.quiz.user<botState.quiz.bot?'Bot wins.':'Draw.'; setStatus(header('Quiz',botState.level)+'<p class="games-mini-note">'+esc(res)+'</p><div class="bot-score-row"><div class="bot-score-card"><b>'+botState.quiz.user+'</b><span>You</span></div><div class="bot-score-card"><b>'+botState.quiz.bot+'</b><span>Bot</span></div><div class="bot-score-card"><b>'+quizQuestions.length+'</b><span>Questions</span></div></div><button class="btn small green" onclick="kalbStartBotGame(\'Quiz\',\''+esc(botState.level)+'\')">Play Again</button></div>'); }
  function truthAnswerLogHtml(){
    var history=(botState.truthHistory||[]).slice(-5).reverse();
    if(!history.length) return '<p class="games-mini-note">Your submitted answers/completions will show here.</p>';
    return '<div class="truth-answer-log">'+history.map(function(item){
      return '<div class="truth-answer-item"><b>'+esc(item.label)+':</b> '+esc(item.task)+'<br><b>You:</b> '+esc(item.answer)+'</div>';
    }).join('')+'</div>';
  }
  function renderTruth(level,message){
    var current=botState.truthCurrent;
    var challenge=current?'<div class="truth-card"><strong>'+esc(current.label)+':</strong> '+esc(current.task)+'</div>':'<div class="truth-card">🎲 Waiting for your choice...</div>';
    var answerBox=current?'<div class="truth-answer-box"><b>Your answer / completion</b><textarea id="truthDareAnswer" placeholder="Type your answer here... For Dare, write what you did."></textarea><div class="truth-answer-actions"><button class="btn small green" onclick="kalbSubmitTruthDareAnswer()">Submit Answer</button><button class="btn small" onclick="kalbTruthDareDone()">I Did It</button><button class="btn small red" onclick="kalbTruthDareSkip()">Skip</button></div>'+(message?'<div class="truth-success-note">'+esc(message)+'</div>':'')+'</div>':'';
    setStatus(
      header('Truth or Dare',level)+
      `<p class="games-mini-note">Choose Truth, Dare, or Random. After the bot gives a challenge, type your answer and submit it.</p>
       <div class="truth-choice-row">
        <button class="btn small green" onclick="kalbTruthDarePick('truth')">Truth</button>
        <button class="btn small red" onclick="kalbTruthDarePick('dare')">Dare</button>
        <button class="btn small" onclick="kalbTruthDarePick('random')">Random</button>
       </div>`+
      challenge+answerBox+truthAnswerLogHtml()+
      `<div class="games-level-row">
        <button class="btn small green" onclick="kalbStartBotGame('Truth or Dare','${esc(level)}')">Reset</button>
        <button class="btn small" onclick="kalbSelectGame('Truth or Dare')">Change Level</button>
       </div></div>`
    );
  }
  function startTruth(level){
    botState.level=level;
    botState.truthCurrent=null;
    botState.truthHistory=botState.truthHistory||[];
    renderTruth(level,'');
  }
  window.kalbTruthDarePick=function(type){
    var level=botState.level||'Normal';
    var mode=type==='random'?(Math.random()<.5?'truth':'dare'):type;
    var pack=(truthData[level]||truthData.Normal);
    var list=pack[mode]||pack.truth;
    var task=list[Math.floor(Math.random()*list.length)]||'No challenge found.';
    var label=mode==='truth'?'Truth':'Dare';
    botState.truthCurrent={mode:mode,label:label,task:task};
    botState.truthHistory=botState.truthHistory||[];
    renderTruth(level,'Bot selected '+label+'. Now write your answer.');
  };
  window.kalbSubmitTruthDareAnswer=function(){
    var current=botState.truthCurrent;
    if(!current) return alert('Choose Truth, Dare, or Random first.');
    var input=document.getElementById('truthDareAnswer');
    var answer=(input&&input.value?input.value:'').trim();
    if(!answer) return alert('Write your answer first.');
    botState.truthHistory=botState.truthHistory||[];
    botState.truthHistory.push({label:current.label,task:current.task,answer:answer,time:Date.now()});
    try{localStorage.setItem('kalbTruthDareHistory',JSON.stringify(botState.truthHistory.slice(-20)));}catch(e){}
    renderTruth(botState.level||'Normal','Answer saved. Pick another Truth or Dare.');
  };
  window.kalbTruthDareDone=function(){
    var current=botState.truthCurrent;
    if(!current) return alert('Choose Truth, Dare, or Random first.');
    botState.truthHistory=botState.truthHistory||[];
    botState.truthHistory.push({label:current.label,task:current.task,answer:'Completed ✅',time:Date.now()});
    try{localStorage.setItem('kalbTruthDareHistory',JSON.stringify(botState.truthHistory.slice(-20)));}catch(e){}
    renderTruth(botState.level||'Normal','Completion saved.');
  };
  window.kalbTruthDareSkip=function(){
    var current=botState.truthCurrent;
    if(!current) return alert('Choose Truth, Dare, or Random first.');
    botState.truthHistory=botState.truthHistory||[];
    botState.truthHistory.push({label:current.label,task:current.task,answer:'Skipped',time:Date.now()});
    try{localStorage.setItem('kalbTruthDareHistory',JSON.stringify(botState.truthHistory.slice(-20)));}catch(e){}
    renderTruth(botState.level||'Normal','Skipped. Pick another challenge.');
  };
  function startPractice(game,level){ setStatus(header(game,level)+'<p class="games-mini-note">'+esc(game)+' bot difficulty is added as a practice mode placeholder. Full '+esc(game)+' engine can be added later; this update keeps your Dashboard, Feed and bottom tabs unchanged.</p><div class="truth-card">🤖 '+esc(level)+' Bot selected. Create Room is still available for friend matches.</div><div class="games-level-row"><button class="btn small green" onclick="kalbCreateGameRoom(\''+esc(game)+'\')">Create Friend Room</button><button class="btn small" onclick="kalbSelectGame(\''+esc(game)+'\')">Change Level</button></div></div>'); }
})();
