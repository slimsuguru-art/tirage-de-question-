// questions.js
// Banque de questions sur le quotidien, organisées par ambiance.
// Ambiances disponibles : nostalgie, humour, reflexion, quotidien.
// Ajoute/retire des questions ici sans toucher au reste du code.

var QUESTIONS = [
  { text: "Quelle est la première chose que tu fais en te réveillant ?", mood: "quotidien" },
  { text: "À quelle heure de la journée es-tu le plus en forme ?", mood: "quotidien" },
  { text: "Quel petit rituel du matin tu ne sautes jamais ?", mood: "quotidien" },
  { text: "Quel est ton plat préféré quand tu manques de temps pour cuisiner ?", mood: "quotidien" },
  { text: "Quelle habitude aimerais-tu enfin adopter cette année ?", mood: "reflexion" },
  { text: "Comment tu te déplaces le plus souvent au quotidien ?", mood: "quotidien" },
  { text: "Quel bruit du quotidien te dérange le plus ?", mood: "humour" },
  { text: "Quel est ton moment préféré de la journée, et pourquoi ?", mood: "reflexion" },
  { text: "Qu'est-ce qui te fait toujours sourire, même un mauvais jour ?", mood: "humour" },
  { text: "Quelle appli regardes-tu le plus sur ton téléphone chaque jour ?", mood: "quotidien" },
  { text: "Si tu avais une heure de libre en plus par jour, tu en ferais quoi ?", mood: "reflexion" },
  { text: "Quel est le dernier truc qui t'a fait rire aujourd'hui ?", mood: "humour" },
  { text: "Quelle est ta boisson du quotidien : café, thé, jus, ou autre chose ?", mood: "quotidien" },
  { text: "Quel est ton snack préféré pour tenir l'après-midi ?", mood: "quotidien" },
  { text: "Qu'est-ce qui te motive à sortir du lit le matin ?", mood: "reflexion" },
  { text: "Quelle chanson tu écoutes en boucle en ce moment ?", mood: "quotidien" },
  { text: "Comment tu décompresses après une journée chargée ?", mood: "reflexion" },
  { text: "Quel est ton endroit préféré dans ta ville pour te poser ?", mood: "nostalgie" },
  { text: "Quelle est la dernière chose que tu as apprise sur toi-même ?", mood: "reflexion" },
  { text: "Quel petit plaisir tu t'offres après une bonne journée ?", mood: "quotidien" },
  { text: "Quelle est ta manière préférée de passer un dimanche ?", mood: "quotidien" },
  { text: "Qu'est-ce que tu fais en premier quand tu rentres chez toi ?", mood: "quotidien" },
  { text: "Quel est ton moyen de transport préféré, et pourquoi ?", mood: "quotidien" },
  { text: "Quelle est la tâche du quotidien que tu détestes le plus ?", mood: "humour" },
  { text: "Quel est ton repas préféré de la journée : petit-déj, déjeuner ou dîner ?", mood: "quotidien" },
  { text: "Quelle habitude de ton entourage t'inspire au quotidien ?", mood: "reflexion" },
  { text: "Quel est le dernier message qui t'a fait plaisir aujourd'hui ?", mood: "nostalgie" },
  { text: "Quelle activité te fait complètement oublier le temps qui passe ?", mood: "reflexion" },
  { text: "Quel est ton juron ou ton mot préféré quand ça ne va pas ?", mood: "humour" },
  { text: "Comment s'appelle la personne que tu appelles en premier quand il y a une bonne nouvelle ?", mood: "nostalgie" },
  { text: "Quel est ton objectif du jour, même tout petit ?", mood: "reflexion" },
  { text: "Quel bruit ou odeur te rappelle immédiatement chez toi ?", mood: "nostalgie" },
  { text: "Quelle est la dernière série ou vidéo que tu as regardée ?", mood: "quotidien" },
  { text: "Quel est ton talent caché que peu de gens connaissent ?", mood: "humour" },
  { text: "Quelle est la première application que tu ouvres le matin ?", mood: "quotidien" },
  { text: "Quel est ton style pour t'habiller un jour normal ?", mood: "quotidien" },
  { text: "Quelle est la dernière fois que tu as aidé quelqu'un aujourd'hui ?", mood: "reflexion" },
  { text: "Quel est ton moment de solitude préféré dans la journée ?", mood: "reflexion" },
  { text: "Quelle est ta petite victoire de la semaine ?", mood: "reflexion" },
  { text: "Quel est l'endroit où tu passes le plus de temps chaque jour ?", mood: "quotidien" },
  { text: "Quelle est la chose la plus utile que tu as dans ton sac ou tes poches ?", mood: "humour" },
  { text: "Quel est ton plus grand distrayant pendant que tu travailles ou étudies ?", mood: "humour" },
  { text: "Quelle est la dernière chose pour laquelle tu as été reconnaissant(e) ?", mood: "reflexion" },
  { text: "Quel est ton moment préféré pour appeler ou parler à tes proches ?", mood: "nostalgie" },
  { text: "Quelle habitude du quotidien tu changerais si tu pouvais ?", mood: "reflexion" },
  { text: "Quel est ton petit luxe du quotidien ?", mood: "quotidien" },
  { text: "Quelle est la dernière chose qui t'a surpris(e) aujourd'hui ?", mood: "humour" },
  { text: "Quel est ton mot d'ordre pour bien commencer la journée ?", mood: "reflexion" },
  { text: "Quelle est la routine que tu suis religieusement chaque soir ?", mood: "quotidien" },
  { text: "Quel est le détail du quotidien que tu ne changerais pour rien au monde ?", mood: "nostalgie" }
];

// Ambiances disponibles pour le sélecteur, dans l'ordre d'affichage.
var MOODS = [
  { id: "toutes",     label: "Toutes",     emoji: "✨" },
  { id: "quotidien",  label: "Quotidien",  emoji: "⚡" },
  { id: "reflexion",  label: "Réflexion",  emoji: "🤔" },
  { id: "humour",     label: "Humour",     emoji: "😄" },
  { id: "nostalgie",  label: "Nostalgie",  emoji: "🌅" }
];
