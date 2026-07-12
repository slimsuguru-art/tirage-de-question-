// functions/api/generate.js
// Fonction Cloudflare Pages : reçoit brand/theme/mechanic depuis le site,
// appelle l'API Anthropic avec la clé secrète stockée côté serveur,
// et renvoie uniquement la question générée.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const brand = (body.brand || "la marque").toString().slice(0, 120);
  const theme = (body.theme || "").toString().slice(0, 400);
  const mechanic = (body.mechanic || "").toString().slice(0, 200);

  const prompt =
    'Tu es concepteur de jeux-concours pour un client. ' +
    'Génère UNE seule question courte, punchy et engageante en français, destinée à un jeu-concours marketing pour la marque "' + brand + '". ' +
    (theme ? ('Contexte / thème du jeu : ' + theme + '. ') : '') +
    (mechanic ? ("Mécanique d'engagement : " + mechanic + '. ') : '') +
    "La question doit donner envie de répondre publiquement (réseaux sociaux, commentaire, story), être adaptée à un public jeune et africain si pertinent, et tenir en une phrase. " +
    'Réponds UNIQUEMENT avec la question elle-même, sans guillemets, sans préambule, sans markdown.';

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "missing_api_key" }, 500);
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return jsonResponse({ error: "upstream_failed", detail: errText }, 502);
    }

    const data = await upstream.json();
    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text);
    const question = textBlocks.join(" ").trim().replace(/^"|"$/g, "");

    if (!question) {
      return jsonResponse({ error: "empty_response" }, 502);
    }

    return jsonResponse({ question });
  } catch (err) {
    return jsonResponse({ error: "server_error" }, 500);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
