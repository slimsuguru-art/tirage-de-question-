// confessions.js
// Espace "Confessions" : partage anonyme plus profond, modéré avant publication,
// réactions positives uniquement (aucun commentaire libre possible).
// Dépend de : config.js, moderation.js, et les mêmes scripts Firebase que app.js.

(function(){

  var db = null;
  var firebaseReady = false;
  try{
    if(typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REMPLACE_MOI"){
      // firebase.initializeApp a déjà été appelé par app.js — on réutilise l'instance.
      db = firebase.firestore();
      firebaseReady = true;
    }
  }catch(e){ firebaseReady = false; }

  // ---------- Navigation entre sections ----------
  var tabs = document.querySelectorAll('.section-tab');
  var sections = {
    quotidien: document.getElementById('section-quotidien'),
    confessions: document.getElementById('section-confessions')
  };
  var feedLoaded = false;

  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var target = tab.getAttribute('data-section');
      tabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      Object.keys(sections).forEach(function(key){
        sections[key].classList.toggle('active', key === target);
      });
      if(target === 'confessions' && !feedLoaded){
        feedLoaded = true;
        loadConfessionsFeed();
      }
    });
  });

  // ---------- Réactions disponibles ----------
  var REACTIONS = [
    { id: 'hug', emoji: '🤗', label: 'Je comprends' },
    { id: 'heart', emoji: '💛', label: 'Courage' },
    { id: 'thanks', emoji: '🙏', label: 'Merci du partage' },
    { id: 'sparkle', emoji: '✨', label: 'Pas seul(e)' }
  ];

  // ---------- Références DOM ----------
  var textarea = document.getElementById('confessionInput');
  var charCountEl = document.getElementById('confessionCharCount');
  var submitBtn = document.getElementById('confessionSubmitBtn');
  var statusEl = document.getElementById('confessionStatus');
  var feedEl = document.getElementById('confessionsFeed');
  var emptyEl = document.getElementById('confessionsEmpty');

  textarea.addEventListener('input', function(){
    charCountEl.textContent = textarea.value.length;
  });

  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------- Envoi d'une confession (file de modération) ----------
  async function submitConfession(){
    var raw = textarea.value.trim();
    if(!raw){ return; }
    if(raw.length < 15){
      statusEl.className = 'confession-status';
      statusEl.textContent = "Un peu court pour être partagé — dis-en un peu plus.";
      return;
    }

    if(!firebaseReady){
      statusEl.className = 'confession-status';
      statusEl.textContent = "Le partage n'est pas encore activé sur ce site.";
      return;
    }

    if(containsBannedWord(raw)){
      statusEl.className = 'confession-status';
      statusEl.textContent = "Ce texte contient des propos non autorisés sur cette plateforme — essaie de reformuler.";
      return;
    }

    var isDistressSignal = containsDistressSignal(raw);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    try{
      await db.collection('confessions_pending').add({
        text: raw.slice(0, 600),
        flagged: isDistressSignal,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      textarea.value = '';
      charCountEl.textContent = '0';

      if(isDistressSignal){
        statusEl.className = 'confession-status support';
        statusEl.innerHTML =
          "<strong>Merci d'avoir partagé ça.</strong><br>" +
          "Ce que tu décris mérite d'être entendu par une vraie personne, pas seulement lu ici. " +
          "Si tu es en France, le <strong>3114</strong> (numéro national de prévention du suicide, gratuit, 24h/24) peut t'écouter. " +
          "Ailleurs, le numéro d'urgence de ton pays ou une personne de confiance autour de toi peuvent aussi t'aider. " +
          "Ta confession a bien été enregistrée et sera relue avant publication.";
      } else {
        statusEl.className = 'confession-status';
        statusEl.textContent = "Merci. Ta confession a été envoyée et sera relue avant d'être visible par les autres.";
      }
    }catch(err){
      statusEl.className = 'confession-status';
      statusEl.textContent = "L'envoi n'a pas abouti, réessaie dans un instant.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Partager anonymement';
    }
  }

  submitBtn.addEventListener('click', submitConfession);

  // ---------- Fil des confessions approuvées ----------
  async function loadConfessionsFeed(){
    if(!firebaseReady){
      emptyEl.textContent = "Le fil n'est pas encore disponible.";
      return;
    }
    try{
      var snap = await db.collection('confessions')
        .orderBy('approvedAt', 'desc')
        .limit(30)
        .get();

      if(snap.empty){
        emptyEl.textContent = "Aucune confession publiée pour l'instant — sois peut-être la première voix.";
        return;
      }

      emptyEl.style.display = 'none';
      snap.forEach(function(doc){
        renderConfessionCard(doc.id, doc.data());
      });
    }catch(e){
      emptyEl.textContent = "Le fil n'a pas pu être chargé.";
    }
  }

  function renderConfessionCard(id, data){
    var card = document.createElement('div');
    card.className = 'confession-card';

    var text = document.createElement('p');
    text.className = 'confession-card-text';
    text.textContent = data.text || '';
    card.appendChild(text);

    var reactionsRow = document.createElement('div');
    reactionsRow.className = 'confession-reactions';

    REACTIONS.forEach(function(r){
      var btn = document.createElement('button');
      btn.className = 'reaction-btn';
      btn.type = 'button';
      var countSpan = document.createElement('span');
      countSpan.className = 'count';
      var initialCount = (data.reactions && data.reactions[r.id]) ? data.reactions[r.id] : 0;
      countSpan.textContent = initialCount;
      btn.appendChild(document.createTextNode(r.emoji + ' '));
      btn.appendChild(countSpan);
      btn.title = r.label;

      btn.addEventListener('click', function(){
        btn.disabled = true;
        var fieldPath = 'reactions.' + r.id;
        var update = {};
        update[fieldPath] = firebase.firestore.FieldValue.increment(1);
        db.collection('confessions').doc(id).update(update)
          .then(function(){
            countSpan.textContent = (parseInt(countSpan.textContent, 10) || 0) + 1;
          })
          .catch(function(){})
          .finally(function(){ btn.disabled = false; });
      });

      reactionsRow.appendChild(btn);
    });

    card.appendChild(reactionsRow);
    feedEl.appendChild(card);
  }

})();
