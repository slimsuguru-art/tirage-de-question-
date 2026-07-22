// scripts/generate-questions.js
//
// Génère un lot de nouvelles questions via l'API Anthropic, les filtre
// (mots interdits + doublons), et les publie dans Supabase (table
// "questions"). Tourne via GitHub Actions sur un planning régulier — voir
// .github/workflows/generate-questions.yml
//
// Variables d'environnement requises :
//   ANTHROPIC_API_KEY     clé API Anthropic (secret GitHub Actions)
//   SUPABASE_URL          URL du projet Supabase (secret GitHub Actions)
//   SUPABASE_SECRET_KEY   clé secrète Supabase, PAS la clé publique
//                          (secret GitHub Actions — donne un accès complet,
//                          ne jamais l'utiliser côté site)

const path = require("path");
const { containsBannedWord, containsSensitiveTopic, normalizeForModeration } =
  require(path.join(__dirname, "..", "moderation.js"));

const BATCH_SIZE = 15;
const MOODS = ["quotidien", "reflexion", "humour", "nostalgie"];

function normalize(text) {
  return normalizeForModeration(text).replace(/[^a-z0-9\s]/g, "");
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Appel Anthropic échoué : " + errText);
  }

  const data = await response.json();
  const textBlocks = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text);
  return textBlocks.join(" ").trim();
}

function buildPrompt(existingSamples) {
  return (
    "Tu conçois des questions courtes pour une plateforme familiale, tout public " +
    "(enfants, parents, adultes), sur le thème du quotidien. Génère " + BATCH_SIZE +
    " NOUVELLES questions en français, variées, jamais offensantes, jamais violentes, " +
    "jamais sexuelles, jamais liées à des sujets sensibles (politique, religion, argent, " +
    "substances). Chaque question doit donner envie de répondre en une phrase courte. " +
    "Répartis-les entre ces 4 ambiances, à peu près en quantité égale : " +
    "\"quotidien\" (habitudes pratiques), \"reflexion\" (introspection légère), " +
    "\"humour\" (ton léger), \"nostalgie\" (souvenirs, attachement). " +
    "Voici des exemples déjà utilisés, à ne pas reproduire ni paraphraser de trop près : " +
    existingSamples.slice(0, 15).join(" / ") + ". " +
    "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown, " +
    "au format exact : " +
    '[{"text":"...", "mood":"quotidien"}, {"text":"...", "mood":"humour"}]'
  );
}

async function supabaseRequest(pathSuffix, options){
  const url = process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + pathSuffix;
  const headers = Object.assign({
    "apikey": process.env.SUPABASE_SECRET_KEY,
    "Authorization": "Bearer " + process.env.SUPABASE_SECRET_KEY,
    "Content-Type": "application/json"
  }, (options && options.headers) || {});
  const response = await fetch(url, Object.assign({}, options, { headers }));
  if(!response.ok){
    const errText = await response.text();
    throw new Error("Requête Supabase échouée (" + pathSuffix + ") : " + errText);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquant");
  if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY manquant");

  // Récupère un échantillon des questions existantes pour éviter les doublons
  const existingRows = await supabaseRequest("questions?select=text&limit=300", { method: "GET" });
  const existingTexts = (existingRows || []).map((r) => r.text).filter(Boolean);
  const existingNormalized = new Set(existingTexts.map(normalize));

  const prompt = buildPrompt(existingTexts);
  const raw = await callClaude(prompt);

  let parsed;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Réponse IA non parsable en JSON : " + raw.slice(0, 300));
  }
  if (!Array.isArray(parsed)) throw new Error("La réponse IA n'est pas un tableau");

  const toInsert = [];
  let rejected = 0;

  for (const item of parsed) {
    if (!item || typeof item.text !== "string" || typeof item.mood !== "string") { rejected++; continue; }
    const text = item.text.trim();
    const mood = MOODS.includes(item.mood) ? item.mood : "quotidien";

    if (text.length < 10 || text.length > 160) { rejected++; continue; }
    if (containsBannedWord(text) || containsSensitiveTopic(text)) { rejected++; continue; }
    const norm = normalize(text);
    if (existingNormalized.has(norm)) { rejected++; continue; }

    existingNormalized.add(norm);
    toInsert.push({ text: text, mood: mood, source: "auto-generated" });
  }

  if (toInsert.length > 0) {
    await supabaseRequest("questions", {
      method: "POST",
      body: JSON.stringify(toInsert)
    });
  }

  console.log("Questions acceptées : " + toInsert.length);
  console.log("Questions rejetées (filtre/doublon) : " + rejected);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
