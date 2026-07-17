// moderation.js
// Modération à plusieurs niveaux, utilisée à la fois côté site (app.js,
// confessions.js) et côté script d'automatisation (scripts/generate-questions.js).
//
// 1. BANNED_WORDS         : insultes/propos haineux — bloqués PARTOUT, y compris
//                            dans les confessions. Jamais une raison légitime de
//                            les publier.
// 2. SENSITIVE_TOPIC_WORDS : sujets sensibles (violence, drogue, armes...) —
//                            bloqués uniquement dans l'espace "Quotidien" léger
//                            (questions du jour), PAS dans les confessions, où
//                            ces sujets peuvent légitimement faire partie d'un
//                            vécu que quelqu'un a besoin de partager.
// 3. DISTRESS_PHRASES      : signaux de détresse — ne bloquent JAMAIS un texte,
//                            déclenchent un message de soutien en plus de la
//                            publication normale. Utilisé dans les confessions.

var BANNED_WORDS = [
  "merde", "putain", "connard", "connasse", "salope", "encule", "enculee",
  "pute", "bordel", "batard", "batarde", "nique", "niquer", "foutre",
  "con", "conne", "pd", "pede", "negre", "negresse", "bougnoule"
];

var SENSITIVE_TOPIC_WORDS = [
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

function tokenMatch(text, wordList){
  if(!text) return false;
  var normalized = normalizeForModeration(text);
  var tokens = normalized.split(' ');
  for(var i = 0; i < wordList.length; i++){
    if(tokens.indexOf(wordList[i]) !== -1) return true;
  }
  return false;
}

function containsBannedWord(text){
  return tokenMatch(text, BANNED_WORDS);
}

function containsSensitiveTopic(text){
  return tokenMatch(text, SENSITIVE_TOPIC_WORDS);
}

// ---------- Détection de signaux de détresse (espace Confessions) ----------
var DISTRESS_PHRASES = [
  "me suicider", "me tuer", "en finir", "plus envie de vivre",
  "envie de mourir", "me faire du mal", "m'automutiler", "me scarifier",
  "personne ne m'aiderait", "je veux disparaitre", "je veux disparaître",
  "j'en peux plus", "je n'en peux plus"
];

function containsDistressSignal(text){
  if(!text) return false;
  var normalized = normalizeForModeration(text);
  for(var i = 0; i < DISTRESS_PHRASES.length; i++){
    var normalizedPhrase = normalizeForModeration(DISTRESS_PHRASES[i]);
    if(normalized.indexOf(normalizedPhrase) !== -1) return true;
  }
  return false;
}

// Compatible navigateur (var globale) ET Node.js (module.exports)
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    BANNED_WORDS: BANNED_WORDS,
    SENSITIVE_TOPIC_WORDS: SENSITIVE_TOPIC_WORDS,
    DISTRESS_PHRASES: DISTRESS_PHRASES,
    containsBannedWord: containsBannedWord,
    containsSensitiveTopic: containsSensitiveTopic,
    containsDistressSignal: containsDistressSignal,
    normalizeForModeration: normalizeForModeration
  };
}
