// app.js
// Logique principale : banque de questions (locale + Firestore), ambiance,
// chronomètre, envoi anonyme modéré, limite quotidienne, classement, partage.
// Dépend de : questions.js (QUESTIONS, MOODS), config.js (firebaseConfig),
// et des scripts Firebase + QRCode chargés dans index.html avant ce fichier.

(function(){

  // Le filtre de mots interdits (BANNED_WORDS, containsBannedWord) est fourni
  // par moderation.js, chargé juste avant ce fichier dans index.html.

  // ---------- Initialisation Firebase ----------
  var db = null;
  var firebaseReady = false;
  try{
    if(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REMPLACE_MOI"){
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
    }
  }catch(e){ firebaseReady = false; }

  // ---------- QR code auto-référencé ----------
  var qrTarget = document.getElementById('qrBox');
  function renderQR(){
    qrTarget.innerHTML = '';
    try{
      new QRCode(qrTarget, {
        text: window.location.href,
        width: 64,
        height: 64,
        colorDark: '#16232A',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }catch(e){
      qrTarget.innerHTML = '<span style="font-size:9px;color:#16232A;">QR indisponible</span>';
    }
  }
  renderQR();

  // ---------- Références DOM ----------
  var drawBtn = document.getElementById('drawBtn');
  var stage = document.getElementById('stage');
  var stubLabel = document.getElementById('stubLabel');
  var ticketNo = document.getElementById('ticketNo');
  var answerZone = document.getElementById('answerZone');
  var answerInput = document.getElementById('answerInput');
  var sendBtn = document.getElementById('sendBtn');
  var matchResult = document.getElementById('matchResult');
  var timerFill = document.getElementById('timerFill');
  var timerNum = document.getElementById('timerNum');
  var moodRow = document.getElementById('moodRow');
  var anonNote = document.querySelector('.anon-note');

  var currentQId = null;
  var currentQuestionText = '';
  var currentAnswerText = '';
  var ANSWER_SECONDS = 30;
  var countdownInterval = null;
  var countdownExpireTimeout = null;

  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function newTicketNumber(){
    var n = Math.floor(100000 + Math.random()*899999);
    ticketNo.textContent = 'N° ' + n;
    return n;
  }

  // ---------- Banque de questions fusionnée (locale + Firestore) ----------
  var ALL_QUESTIONS = [];

  function buildLocalQuestions(){
    return QUESTIONS.map(function(q, i){
      return { id: 'local-' + i, text: q.text, mood: q.mood };
    });
  }

  async function loadAllQuestions(){
    var local = buildLocalQuestions();
    if(!firebaseReady){
      ALL_QUESTIONS = local;
      return;
    }
    try{
      var snap = await db.collection('questions').limit(500).get();
      var remote = [];
      snap.forEach(function(doc){
        var d = doc.data();
        if(d && typeof d.text === 'string' && typeof d.mood === 'string'){
          remote.push({ id: doc.id, text: d.text, mood: d.mood });
        }
      });
      ALL_QUESTIONS = local.concat(remote);
    }catch(e){
      ALL_QUESTIONS = local;
    }
  }

  // ---------- Sélecteur d'ambiance ----------
  var currentMood = 'toutes';

  function renderMoodChips(){
    moodRow.innerHTML = '';
    MOODS.forEach(function(m){
      var btn = document.createElement('button');
      btn.className = 'mood-chip' + (m.id === currentMood ? ' active' : '');
      btn.type = 'button';
      btn.textContent = m.emoji + ' ' + m.label;
      btn.addEventListener('click', function(){
        if(currentMood === m.id) return;
        currentMood = m.id;
        bagIndexes = [];
        renderMoodChips();
      });
      moodRow.appendChild(btn);
    });
  }

  function moodLabelFor(id){
    var found = null;
    for(var i = 0; i < MOODS.length; i++){
      if(MOODS[i].id === id){ found = MOODS[i]; break; }
    }
    return found ? (found.emoji + ' ' + found.label) : '';
  }

  // ---------- Sac à tirage sans répétition (filtré par ambiance) ----------
  var bagIndexes = [];
  function refillBag(){
    var pool = [];
    for(var i = 0; i < ALL_QUESTIONS.length; i++){
      if(currentMood === 'toutes' || ALL_QUESTIONS[i].mood === currentMood){
        pool.push(i);
      }
    }
    if(pool.length === 0){
      for(var j = 0; j < ALL_QUESTIONS.length; j++){ pool.push(j); }
    }
    for(var k = pool.length - 1; k > 0; k--){
      var r = Math.floor(Math.random() * (k + 1));
      var tmp = pool[k]; pool[k] = pool[r]; pool[r] = tmp;
    }
    bagIndexes = pool;
  }
  function drawIndexFromBag(){
    if(bagIndexes.length === 0){ refillBag(); }
    return bagIndexes.pop();
  }

  // ---------- Compteur global en temps réel ----------
  var globalCountEl = document.getElementById('globalCount');
  var displayedCount = null;

  function formatNumber(n){
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function animateCounterTo(target){
    if(displayedCount === null){
      displayedCount = target;
      globalCountEl.textContent = formatNumber(target);
      return;
    }
    if(target === displayedCount) return;

    var start = displayedCount;
    var startTime = null;
    var duration = 600;

    function step(ts){
      if(startTime === null) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var value = Math.round(start + (target - start) * progress);
      globalCountEl.textContent = formatNumber(value);
      if(progress < 1){
        requestAnimationFrame(step);
      } else {
        displayedCount = target;
        globalCountEl.classList.add('bump');
        setTimeout(function(){ globalCountEl.classList.remove('bump'); }, 400);
      }
    }
    requestAnimationFrame(step);
  }

  function setupGlobalCounter(){
    if(firebaseReady){
      try{
        db.collection('stats').doc('global').onSnapshot(function(doc){
          var total = (doc.exists && typeof doc.data().totalAnswers === 'number') ? doc.data().totalAnswers : 0;
          animateCounterTo(total);
        }, function(){
          globalCountEl.textContent = '—';
        });
      }catch(e){
        globalCountEl.textContent = '—';
      }
    } else {
      globalCountEl.textContent = '—';
    }
  }

  // ---------- Limite quotidienne de réponses envoyées ----------
  var MAX_ANSWERS_PER_DAY = 4;
  var DAILY_KEY = 'tirage_daily_answers';

  function todayStr(){
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function getDailyState(){
    try{
      var raw = localStorage.getItem(DAILY_KEY);
      if(!raw) return { date: todayStr(), count: 0 };
      var parsed = JSON.parse(raw);
      if(parsed.date !== todayStr()) return { date: todayStr(), count: 0 };
      return parsed;
    }catch(e){
      return { date: todayStr(), count: 0 };
    }
  }

  function saveDailyState(state){
    try{ localStorage.setItem(DAILY_KEY, JSON.stringify(state)); }catch(e){}
  }

  function remainingAnswersToday(){
    var state = getDailyState();
    return Math.max(0, MAX_ANSWERS_PER_DAY - state.count);
  }

  function registerAnswerSent(){
    var state = getDailyState();
    state.count++;
    saveDailyState(state);
  }

  function updateAnonNote(){
    var remaining = remainingAnswersToday();
    if(remaining > 0){
      anonNote.textContent = "Aucun nom, aucune donnée personnelle n'est enregistrée. Il te reste " + remaining + ' réponse' + (remaining > 1 ? 's' : '') + " aujourd'hui.";
    } else {
      anonNote.textContent = "Tu as utilisé tes réponses du jour — reviens demain pour en envoyer d'autres !";
    }
  }

  // ---------- Série (streak) de jours consécutifs ----------
  var STREAK_KEY = 'tirage_streak';
  var streakBadge = document.getElementById('streakBadge');
  var streakCountEl = document.getElementById('streakCount');
  var streakPluralEl = document.getElementById('streakPlural');

  function dateStrFromDate(d){
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function yesterdayStr(){
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return dateStrFromDate(d);
  }

  function getStreakState(){
    try{
      var raw = localStorage.getItem(STREAK_KEY);
      if(!raw) return { lastAnswerDate: null, streak: 0 };
      return JSON.parse(raw);
    }catch(e){
      return { lastAnswerDate: null, streak: 0 };
    }
  }
  function saveStreakState(state){
    try{ localStorage.setItem(STREAK_KEY, JSON.stringify(state)); }catch(e){}
  }

  function renderStreak(count, animate){
    if(count > 0){
      streakBadge.style.display = '';
      streakCountEl.textContent = count;
      streakPluralEl.textContent = count > 1 ? 's' : '';
      if(animate){
        streakBadge.classList.add('bump');
        setTimeout(function(){ streakBadge.classList.remove('bump'); }, 400);
      }
    } else {
      streakBadge.style.display = 'none';
    }
  }

  function displayCurrentStreak(){
    var state = getStreakState();
    var today = todayStr();
    if(state.lastAnswerDate === today || state.lastAnswerDate === yesterdayStr()){
      renderStreak(state.streak, false);
    } else {
      renderStreak(0, false);
    }
  }

  function registerStreakOnAnswer(){
    var state = getStreakState();
    var today = todayStr();
    if(state.lastAnswerDate === today){
      // déjà comptée aujourd'hui, rien à faire
      return;
    }
    if(state.lastAnswerDate === yesterdayStr()){
      state.streak = (state.streak || 0) + 1;
    } else {
      state.streak = 1;
    }
    state.lastAnswerDate = today;
    saveStreakState(state);
    renderStreak(state.streak, true);
  }

  // ---------- Chronomètre ----------
  function stopCountdown(){
    clearInterval(countdownInterval);
    clearTimeout(countdownExpireTimeout);
  }

  function startCountdown(){
    stopCountdown();
    var remaining = ANSWER_SECONDS;
    timerFill.style.transition = 'none';
    timerFill.style.width = '100%';
    timerFill.classList.remove('urgent');
    timerNum.classList.remove('urgent');
    timerNum.textContent = remaining + 's';
    void timerFill.offsetWidth;
    timerFill.style.transition = 'width 1s linear, background .3s ease';

    requestAnimationFrame(function(){
      timerFill.style.width = '0%';
    });

    countdownInterval = setInterval(function(){
      remaining--;
      if(remaining <= 0){
        timerNum.textContent = '0s';
        clearInterval(countdownInterval);
        return;
      }
      timerNum.textContent = remaining + 's';
      if(remaining <= 6){
        timerFill.classList.add('urgent');
        timerNum.classList.add('urgent');
      }
    }, 1000);

    countdownExpireTimeout = setTimeout(function(){
      onCountdownExpire();
    }, ANSWER_SECONDS * 1000);
  }

  function onCountdownExpire(){
    if(answerInput.disabled) return;
    answerInput.disabled = true;
    sendBtn.disabled = true;
    matchResult.innerHTML = "⏱️ Temps écoulé ! Tire une nouvelle question pour retenter ta chance.";
    matchResult.classList.add('show');
  }

  function resetAnswerZone(){
    matchResult.classList.remove('show');
    matchResult.innerHTML = '';
    answerZone.classList.add('active');
    updateAnonNote();

    if(remainingAnswersToday() <= 0){
      answerInput.value = '';
      answerInput.disabled = true;
      sendBtn.disabled = true;
      stopCountdown();
      timerFill.style.width = '0%';
      timerNum.textContent = '0s';
      return;
    }

    answerInput.value = '';
    answerInput.disabled = false;
    sendBtn.disabled = false;
    startCountdown();
    answerInput.focus();
  }

  var flickerWords = ['?','·','—','?','·','—'];
  var flickerTimer = null;

  // ---------- Question spéciale du jour ----------
  function getDailyIndex(){
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 0);
    var diff = now - startOfYear;
    var dayOfYear = Math.floor(diff / 86400000);
    return dayOfYear % ALL_QUESTIONS.length;
  }

  function drawQuestion(forcedIndex, isSpecial){
    stopCountdown();
    drawBtn.disabled = true;
    answerZone.classList.remove('active');
    stage.innerHTML = '<p class="flicker" id="flickerP"></p>';
    var el = document.getElementById('flickerP');
    var i = 0;
    flickerTimer = setInterval(function(){
      el.textContent = flickerWords[i % flickerWords.length];
      i++;
    }, 80);

    newTicketNumber();
    renderQR();

    var qIndex = (typeof forcedIndex === 'number') ? forcedIndex : drawIndexFromBag();
    var item = ALL_QUESTIONS[qIndex];
    currentQId = item.id;
    currentQuestionText = item.text;
    var questionMood = item.mood;

    var ticketEl = document.querySelector('.ticket');

    setTimeout(function(){
      clearInterval(flickerTimer);
      stage.innerHTML = '<p class="settled">' + escapeHtml(currentQuestionText) + '</p>';
      if(isSpecial){
        stubLabel.innerHTML = '⭐ Question spéciale du jour';
        stubLabel.classList.add('special');
        if(ticketEl) ticketEl.classList.add('special');
      } else {
        stubLabel.innerHTML = 'Question du jour <span class="mood-tag">· ' + moodLabelFor(questionMood) + '</span>';
        stubLabel.classList.remove('special');
        if(ticketEl) ticketEl.classList.remove('special');
      }
      drawBtn.disabled = false;
      resetAnswerZone();
    }, 650);
  }

  function normalizeAnswer(s){
    return s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---------- Envoi anonyme + comparaison ----------
  async function sendAnswer(){
    var raw = answerInput.value.trim();
    if(!raw || currentQId === null) return;
    if(answerInput.disabled) return;
    if(remainingAnswersToday() <= 0){
      updateAnonNote();
      return;
    }

    if(containsBannedWord(raw)){
      matchResult.innerHTML = "Cette réponse contient un mot non autorisé sur cette plateforme familiale — essaie de la reformuler.";
      matchResult.classList.add('show');
      return;
    }

    stopCountdown();

    if(!firebaseReady){
      matchResult.innerHTML = "Le partage anonyme n'est pas encore activé sur ce site (configuration en attente).";
      matchResult.classList.add('show');
      return;
    }

    var key = normalizeAnswer(raw);
    if(!key){
      matchResult.innerHTML = 'Réponse trop courte pour être comparée, réessaie.';
      matchResult.classList.add('show');
      return;
    }

    sendBtn.disabled = true;
    answerInput.disabled = true;
    matchResult.innerHTML = 'Comparaison en cours…';
    matchResult.classList.add('show');

    var thisQId = currentQId;
    var thisQuestionText = currentQuestionText;

    try{
      var col = db.collection('answers');
      var snap = await col
        .where('qId', '==', thisQId)
        .where('key', '==', key)
        .get();

      var matchCount = snap.size;

      await col.add({
        qId: thisQId,
        question: thisQuestionText,
        key: key,
        answer: raw.slice(0, 80),
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });

      db.collection('stats').doc('global').set({
        totalAnswers: firebase.firestore.FieldValue.increment(1)
      }, { merge: true }).catch(function(){});

      registerAnswerSent();
      registerStreakOnAnswer();
      currentAnswerText = raw.slice(0, 80);

      var headline;
      if(matchCount > 0){
        headline = '🔗 <strong>' + matchCount + '</strong> autre' + (matchCount > 1 ? 's' : '') +
          ' personne' + (matchCount > 1 ? 's ont' : ' a') + ' répondu comme toi à cette question.';
      } else {
        headline = "Tu es la première personne à répondre ainsi à cette question — ta réponse est maintenant enregistrée anonymement.";
      }
      matchResult.innerHTML = headline;

      await loadTopAnswers(thisQId);
      renderShareButton();
      updateAnonNote();

      if(remainingAnswersToday() <= 0){
        answerInput.disabled = true;
        sendBtn.disabled = true;
      }
    }catch(err){
      matchResult.innerHTML = "La comparaison n'a pas pu aboutir, réessaie dans un instant.";
      sendBtn.disabled = false;
      answerInput.disabled = false;
    }
  }

  async function loadTopAnswers(qId){
    try{
      var snap = await db.collection('answers')
        .where('qId', '==', qId)
        .limit(200)
        .get();

      var freq = {};
      snap.forEach(function(doc){
        var d = doc.data();
        if(!d.key) return;
        if(!freq[d.key]){ freq[d.key] = { count: 0, sample: d.answer || d.key }; }
        freq[d.key].count++;
      });

      var ranked = Object.keys(freq).map(function(k){
        return { key: k, count: freq[k].count, sample: freq[k].sample };
      }).sort(function(a, b){ return b.count - a.count; }).slice(0, 3);

      if(ranked.length === 0) return;

      var maxCount = ranked[0].count;
      var html = '<div class="top-list"><div class="top-list-title">Réponses les plus fréquentes</div>';
      ranked.forEach(function(item, idx){
        var pct = Math.round((item.count / maxCount) * 100);
        html += '<div class="top-item">' +
          '<span class="rank">' + (idx + 1) + '</span>' +
          '<span class="label">' + escapeHtml(item.sample) + '</span>' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="count">' + item.count + '</span>' +
        '</div>';
      });
      html += '</div>';

      matchResult.innerHTML += html;
    }catch(e){
      // silencieux : le classement est un bonus, pas critique
    }
  }

  // ---------- Partage (carte image + Web Share API) ----------
  function renderShareButton(){
    var html = '<div class="share-row"><button class="share-btn" id="shareBtn">Partager ma réponse</button></div>' +
      '<div class="share-note">Génère une image avec ta question et ta réponse, sans aucune donnée personnelle.</div>';
    matchResult.insertAdjacentHTML('beforeend', html);
    document.getElementById('shareBtn').addEventListener('click', shareAnswer);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    var words = text.split(' ');
    var line = '';
    var lines = [];
    for(var n = 0; n < words.length; n++){
      var testLine = line + words[n] + ' ';
      if(ctx.measureText(testLine).width > maxWidth && n > 0){
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    lines.forEach(function(l, i){
      ctx.fillText(l, x, y + i * lineHeight);
    });
    return lines.length * lineHeight;
  }

  function buildShareCanvas(question, answer){
    var W = 800, H = 800;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var grad = ctx.createRadialGradient(W*0.2, H*0.15, 50, W*0.5, H*0.5, W*0.8);
    grad.addColorStop(0, '#2A2049');
    grad.addColorStop(1, '#16232A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var cardX = 60, cardY = 140, cardW = W - 120, cardH = 480;
    ctx.fillStyle = '#1E2E35';
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    ctx.fillStyle = '#16232A';
    ctx.beginPath(); ctx.arc(cardX, cardY + cardH/2, 20, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cardX + cardW, cardY + cardH/2, 20, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#E3A857';
    ctx.font = '600 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QUESTION DU JOUR', W/2, cardY + 56);

    ctx.fillStyle = '#F2EDE2';
    ctx.font = "600 32px 'Fraunces', serif";
    ctx.textAlign = 'left';
    var qHeight = wrapText(ctx, question, cardX + 40, cardY + 120, cardW - 80, 44);

    var dividerY = cardY + 120 + qHeight + 30;
    ctx.strokeStyle = '#2C4048';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cardX + 30, dividerY);
    ctx.lineTo(cardX + cardW - 30, dividerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9FB3B4';
    ctx.font = '600 16px monospace';
    ctx.fillText('MA RÉPONSE', cardX + 40, dividerY + 40);
    ctx.fillStyle = '#E08668';
    ctx.font = "600 28px 'Fraunces', serif";
    wrapText(ctx, answer, cardX + 40, dividerY + 82, cardW - 80, 38);

    ctx.fillStyle = '#9FB3B4';
    ctx.font = '500 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fais le test toi aussi \u2192', W/2, H - 60);
    ctx.font = '600 16px monospace';
    ctx.fillStyle = '#E3A857';
    ctx.fillText(window.location.hostname || 'scan le QR code', W/2, H - 32);

    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function shareAnswer(){
    var shareBtn = document.getElementById('shareBtn');
    if(shareBtn){ shareBtn.disabled = true; shareBtn.textContent = 'Préparation…'; }

    try{
      var canvas = buildShareCanvas(currentQuestionText, currentAnswerText);
      var blob = await new Promise(function(resolve){
        canvas.toBlob(resolve, 'image/png');
      });

      var shareText = 'Ma réponse du jour : « ' + currentAnswerText + ' » — et toi ?';

      if(navigator.canShare && navigator.canShare({ files: [new File([blob], 'mon-quotidien.png', { type: 'image/png' })] })){
        var file = new File([blob], 'mon-quotidien.png', { type: 'image/png' });
        await navigator.share({
          files: [file],
          text: shareText
        });
      } else if(navigator.share){
        await navigator.share({ text: shareText, url: window.location.href });
      } else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'mon-quotidien.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        try{ await navigator.clipboard.writeText(shareText); }catch(e){}
      }
    }catch(e){
      // L'utilisateur a peut-être annulé le partage natif : pas d'erreur à afficher
    } finally {
      if(shareBtn){ shareBtn.disabled = false; shareBtn.textContent = 'Partager ma réponse'; }
    }
  }

  // ---------- Initialisation ----------
  async function init(){
    await loadAllQuestions();
    renderMoodChips();
    setupGlobalCounter();
    displayCurrentStreak();

    drawBtn.addEventListener('click', function(){ drawQuestion(); });
    sendBtn.addEventListener('click', sendAnswer);
    answerInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ sendAnswer(); }
    });

    drawQuestion(getDailyIndex(), true);
  }

  init();

})();
