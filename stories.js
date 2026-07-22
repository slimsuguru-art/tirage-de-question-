// stories.js
// Gère "Partager mon histoire" (soumission vers stories_pending) et
// "Les Histoires" (fil des histoires approuvées, filtrable par thème,
// réactions bienveillantes uniquement). Utilise Supabase.

(function(){

  var sb = null;
  var supabaseReady = false;
  try{
    if(typeof supabaseConfig !== 'undefined' && supabaseConfig.url && supabaseConfig.anonKey){
      sb = supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
      supabaseReady = true;
    }
  }catch(e){ supabaseReady = false; }

  var THEMES = [
    { id: 'solitude', label: 'Solitude' },
    { id: 'etudes', label: 'Études' },
    { id: 'famille', label: 'Famille' },
    { id: 'anxiete-sociale', label: 'Anxiété Sociale' }
  ];

  var REACTIONS = [
    { id: 'coeur', emoji: '🤍', label: 'Je suis avec toi' },
    { id: 'main', emoji: '🤝', label: 'Solidaire' },
    { id: 'etoile', emoji: '✨', label: 'Courage' }
  ];

  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function themeLabel(id){
    for(var i = 0; i < THEMES.length; i++){
      if(THEMES[i].id === id) return THEMES[i].label;
    }
    return id;
  }

  // ================== PAGE : partager.html ==================
  var storyText = document.getElementById('storyText');
  if(storyText){
    var storyTheme = document.getElementById('storyTheme');
    var charCountEl = document.getElementById('storyCharCount');
    var submitBtn = document.getElementById('storySubmitBtn');
    var statusEl = document.getElementById('storyStatus');

    storyText.addEventListener('input', function(){
      charCountEl.textContent = storyText.value.length;
    });

    submitBtn.addEventListener('click', async function(){
      var raw = storyText.value.trim();
      if(!raw){ return; }
      if(raw.length < 30){
        statusEl.className = 'form-status';
        statusEl.textContent = "Un peu court pour une histoire — dis-en un peu plus, si tu en as la force.";
        return;
      }
      if(!supabaseReady){
        statusEl.className = 'form-status';
        statusEl.textContent = "Le partage n'est pas encore activé sur ce site.";
        return;
      }
      if(typeof containsBannedWord === 'function' && containsBannedWord(raw)){
        statusEl.className = 'form-status';
        statusEl.textContent = "Ce texte contient des propos non autorisés — essaie de reformuler.";
        return;
      }

      var isDistress = typeof containsDistressSignal === 'function' && containsDistressSignal(raw);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';

      try{
        var result = await sb.from('stories_pending').insert({
          text: raw.slice(0, 1500),
          theme: storyTheme.value,
          flagged: isDistress,
          status: 'pending'
        });

        if(result.error){ throw new Error(result.error.message); }

        storyText.value = '';
        charCountEl.textContent = '0';

        if(isDistress){
          statusEl.className = 'form-status support';
          statusEl.innerHTML =
            "<strong>Merci d'avoir écrit ça.</strong><br>" +
            "Ce que tu décris mérite d'être entendu par une vraie personne, pas seulement lu ici. " +
            "Si tu es en France, le <strong>3114</strong> (numéro national de prévention du suicide, gratuit, 24h/24) peut t'écouter. " +
            "Ailleurs, le numéro d'urgence de ton pays ou une personne de confiance autour de toi peuvent aussi t'aider. " +
            "Ton histoire a bien été enregistrée et sera relue avant publication.";
        } else {
          statusEl.className = 'form-status';
          statusEl.textContent = "Merci. Ton histoire a été envoyée et sera relue avant d'être visible par les autres.";
        }
      }catch(err){
        statusEl.className = 'form-status';
        statusEl.textContent = "L'envoi n'a pas abouti, réessaie dans un instant.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Partager anonymement';
      }
    });
  }

  // ================== PAGE : histoires.html ==================
  var storiesFeed = document.getElementById('storiesFeed');
  if(storiesFeed){
    var themeRow = document.getElementById('themeRow');
    var storiesEmpty = document.getElementById('storiesEmpty');
    var currentTheme = 'toutes';

    function renderThemeChips(){
      themeRow.innerHTML = '';
      var allChip = document.createElement('button');
      allChip.className = 'theme-chip' + (currentTheme === 'toutes' ? ' active' : '');
      allChip.type = 'button';
      allChip.textContent = '✨ Toutes';
      allChip.addEventListener('click', function(){ selectTheme('toutes'); });
      themeRow.appendChild(allChip);

      THEMES.forEach(function(t){
        var chip = document.createElement('button');
        chip.className = 'theme-chip' + (currentTheme === t.id ? ' active' : '');
        chip.type = 'button';
        chip.textContent = t.label;
        chip.addEventListener('click', function(){ selectTheme(t.id); });
        themeRow.appendChild(chip);
      });
    }

    function selectTheme(id){
      if(currentTheme === id) return;
      currentTheme = id;
      renderThemeChips();
      loadStoriesFeed();
    }

    async function loadStoriesFeed(){
      if(!supabaseReady){
        storiesEmpty.style.display = '';
        storiesEmpty.textContent = "Le fil n'est pas encore disponible.";
        return;
      }
      storiesFeed.innerHTML = '';
      storiesFeed.appendChild(storiesEmpty);
      storiesEmpty.style.display = '';
      storiesEmpty.textContent = 'Chargement…';

      try{
        var query = sb.from('stories').select('id,text,theme,reactions').order('approved_at', { ascending: false }).limit(50);
        if(currentTheme !== 'toutes'){
          query = query.eq('theme', currentTheme);
        }
        var result = await query;
        if(result.error){ throw new Error(result.error.message); }

        var rows = result.data || [];
        if(rows.length === 0){
          storiesEmpty.textContent = "Aucune histoire dans cette thématique pour l'instant — sois peut-être la première voix.";
          return;
        }

        storiesEmpty.style.display = 'none';
        rows.forEach(function(row){
          renderStoryCard(row.id, row);
        });
      }catch(e){
        storiesEmpty.textContent = "Le fil n'a pas pu être chargé.";
      }
    }

    function renderStoryCard(id, data){
      var card = document.createElement('div');
      card.className = 'story-card';

      var tag = document.createElement('div');
      tag.className = 'story-theme-tag';
      tag.textContent = themeLabel(data.theme);
      card.appendChild(tag);

      var text = document.createElement('p');
      text.className = 'story-text';
      text.textContent = data.text || '';
      card.appendChild(text);

      var reactionsRow = document.createElement('div');
      reactionsRow.className = 'story-reactions';

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
          sb.rpc('increment_reaction', { story_id: id, reaction_key: r.id })
            .then(function(result){
              if(!result.error){
                countSpan.textContent = (parseInt(countSpan.textContent, 10) || 0) + 1;
              }
            })
            .catch(function(){})
            .finally(function(){ btn.disabled = false; });
        });

        reactionsRow.appendChild(btn);
      });

      card.appendChild(reactionsRow);
      storiesFeed.appendChild(card);
    }

    renderThemeChips();
    loadStoriesFeed();
  }

})();
