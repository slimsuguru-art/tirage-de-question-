// admin.js
// Page de modération : connexion Firebase Auth, liste des confessions en
// attente, approuver (les publie dans "confessions") ou rejeter (les supprime).
// Accès protégé par les règles Firestore (voir instructions), pas seulement
// par ce code — la vraie sécurité vient des règles, pas du mot de passe seul.

(function(){
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var loginBox = document.getElementById('loginBox');
  var adminPanel = document.getElementById('adminPanel');
  var emailInput = document.getElementById('emailInput');
  var passwordInput = document.getElementById('passwordInput');
  var loginBtn = document.getElementById('loginBtn');
  var loginError = document.getElementById('loginError');
  var logoutBtn = document.getElementById('logoutBtn');
  var adminEmailEl = document.getElementById('adminEmail');
  var pendingList = document.getElementById('pendingList');

  loginBtn.addEventListener('click', function(){
    loginError.textContent = '';
    auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value)
      .catch(function(err){
        loginError.textContent = "Connexion échouée : " + err.message;
      });
  });

  logoutBtn.addEventListener('click', function(){
    auth.signOut();
  });

  auth.onAuthStateChanged(function(user){
    if(user){
      loginBox.style.display = 'none';
      adminPanel.style.display = '';
      adminEmailEl.textContent = user.email;
      loadPending();
    } else {
      loginBox.style.display = '';
      adminPanel.style.display = 'none';
    }
  });

  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadPending(){
    pendingList.innerHTML = '<p class="empty-msg">Chargement…</p>';
    try{
      var snap = await db.collection('confessions_pending')
        .where('status', '==', 'pending')
        .limit(50)
        .get();

      if(snap.empty){
        pendingList.innerHTML = '<p class="empty-msg">Rien en attente pour le moment.</p>';
        return;
      }

      pendingList.innerHTML = '';
      snap.forEach(function(doc){
        renderPendingItem(doc.id, doc.data());
      });
    }catch(e){
      pendingList.innerHTML = '<p class="empty-msg">Erreur de chargement : ' + escapeHtml(e.message) + '</p>';
    }
  }

  function renderPendingItem(id, data){
    var item = document.createElement('div');
    item.className = 'pending-item' + (data.flagged ? ' flagged' : '');

    if(data.flagged){
      var flag = document.createElement('div');
      flag.className = 'pending-flag-note';
      flag.textContent = '⚠️ Signal de détresse détecté — priorité de lecture';
      item.appendChild(flag);
    }

    var text = document.createElement('p');
    text.className = 'pending-text';
    text.textContent = data.text || '';
    item.appendChild(text);

    var actions = document.createElement('div');
    actions.className = 'pending-actions';

    var approveBtn = document.createElement('button');
    approveBtn.className = 'approve-btn';
    approveBtn.textContent = 'Approuver et publier';
    approveBtn.addEventListener('click', function(){
      approve(id, data, item);
    });

    var rejectBtn = document.createElement('button');
    rejectBtn.className = 'reject-btn';
    rejectBtn.textContent = 'Rejeter';
    rejectBtn.addEventListener('click', function(){
      reject(id, item);
    });

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
    item.appendChild(actions);

    pendingList.appendChild(item);
  }

  async function approve(id, data, itemEl){
    try{
      await db.collection('confessions').add({
        text: data.text,
        reactions: { hug: 0, heart: 0, thanks: 0, sparkle: 0 },
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('confessions_pending').doc(id).delete();
      itemEl.remove();
    }catch(e){
      alert("Erreur lors de l'approbation : " + e.message);
    }
  }

  async function reject(id, itemEl){
    try{
      await db.collection('confessions_pending').doc(id).delete();
      itemEl.remove();
    }catch(e){
      alert("Erreur lors du rejet : " + e.message);
    }
  }

})();
