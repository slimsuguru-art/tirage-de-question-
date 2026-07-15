// moderation.js
// Liste de mots interdits + fonction de vérification, utilisée à deux endroits :
// 1. Côté site (app.js) pour filtrer les réponses tapées par les visiteurs
// 2. Côté script d'automatisation (scripts/generate-questions.js) pour filtrer
//    les questions générées par IA avant publication
//
// Ce filtre est volontairement simple (liste de mots + normalisation).
// Ce n'est pas une modération parfaite, mais une première barrière de sécurité,
// particulièrement importante pour un public incluant des enfants.

var BANNED_WORDS = [
  "merde", "putain", "connard", "connasse", "salope", "encule", "enculee",
  "pute", "bordel", "batard", "batarde", "nique", "niquer", "foutre",
  "con", "conne", "pd", "pede", "negre", "negresse", "bougnoule",
  "sexe", "porno", "pornographie", "drogue", "cocaine", "heroine",
  "suicide", "automutilation", "viol", "violer", "meurtre", "tuer",
  "arme", "pistolet", "fusil", "bombe", "nazi", "hitler", "terroriste"
];

function normalizeForModeration(text){
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsBannedWord(text){
  if(!text) return false;
  var normalized = normalizeForModeration(text);
  var tokens = normalized.split(' ');
  for(var i = 0; i < BANNED_WORDS.length; i++){
    if(tokens.indexOf(BANNED_WORDS[i]) !== -1) return true;
  }
  return false;
}

// Compatible navigateur (var globale) ET Node.js (module.exports)
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    BANNED_WORDS: BANNED_WORDS,
    containsBannedWord: containsBannedWord,
    normalizeForModeration: normalizeForModeration
  };
}
