const encoder = new TextEncoder();
const decoder = new TextDecoder();
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const PLACES_BASE = "https://places.googleapis.com/v1";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const jwkCache = new Map();

function b64urlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function bytesToB64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function encodeB64url(value) { return bytesToB64url(encoder.encode(value)); }
function decodeJwtPart(part) { return JSON.parse(decoder.decode(b64urlToBytes(part))); }
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) }
  });
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://kwakebe2781.github.io,http://localhost:8787")
    .split(",").map(x => x.trim()).filter(Boolean);
  const headers = { "Vary": "Origin", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > (maxBytes || 250000)) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > (maxBytes || 250000)) throw new Error("REQUEST_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new Error("INVALID_JSON"); }
}
async function verifyGoogleIdToken(token, env) {
  if (!token || token.length > 10000 || !env.GOOGLE_CLIENT_ID) throw new Error("AUTH_REQUIRED");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("INVALID_TOKEN");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("INVALID_TOKEN");
  if (claims.iss !== "accounts.google.com" && claims.iss !== "https://accounts.google.com") throw new Error("INVALID_TOKEN");
  if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new Error("INVALID_AUDIENCE");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= now || claims.iat > now + 120) throw new Error("TOKEN_EXPIRED");
  if (!claims.sub || !claims.email || !(claims.email_verified === true || claims.email_verified === "true")) throw new Error("INVALID_TOKEN");
  let key = jwkCache.get(header.kid);
  if (!key) {
    const response = await fetch(GOOGLE_CERTS, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!response.ok) throw new Error("GOOGLE_CERTS_UNAVAILABLE");
    const set = await response.json();
    const jwk = (set.keys || []).find(item => item.kid === header.kid && item.kty === "RSA" && item.use === "sig");
    if (!jwk) throw new Error("UNKNOWN_SIGNING_KEY");
    key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    jwkCache.set(header.kid, key);
  }
  const signingInput = encoder.encode(parts[0] + "." + parts[1]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), signingInput);
  if (!valid) throw new Error("INVALID_SIGNATURE");
  return { sub: String(claims.sub), email: String(claims.email), name: String(claims.name || ""), picture: String(claims.picture || "") };
}
async function requireUser(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  return verifyGoogleIdToken(match[1], env);
}
function safePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_DATA");
  const wishes = Array.isArray(value.wishes) ? value.wishes.slice(0, 1000) : [];
  const plans = Array.isArray(value.plans) ? value.plans.slice(0, 1000) : [];
  const cleanItems = items => items.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const id = String(item.id || "");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return null;
    return {
      id,
      title: String(item.title || "").slice(0, 300),
      area: String(item.area || "").slice(0, 300),
      memo: String(item.memo || "").slice(0, 2000),
      date: String(item.date || "").slice(0, 10),
      time: String(item.time || "").slice(0, 5),
      photos: Array.isArray(item.photos) ? item.photos.slice(0, 3).filter(p => typeof p === "string" && p.length < 900000) : [],
      photoUrl: typeof item.photoUrl === "string" && item.photoUrl.startsWith("https://") ? item.photoUrl.slice(0, 2000) : "",
      mapsUrl: typeof item.mapsUrl === "string" && item.mapsUrl.startsWith("https://") ? item.mapsUrl.slice(0, 2000) : "",
      placeId: typeof item.placeId === "string" ? item.placeId.slice(0, 200) : "",
      _updatedAt: Number(item._updatedAt || 0)
    };
  }).filter(Boolean);
  const tombstones = Array.isArray(value.tombstones) ? value.tombstones.slice(-3000).filter(t =>
    t && typeof t.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(t.id) &&
    ["wishes", "plans"].includes(t.collection) && Number.isFinite(Number(t.deletedAt))
  ).map(t => ({ id: t.id, collection: t.collection, deletedAt: Number(t.deletedAt) })) : [];
  return {
    wishes: cleanItems(wishes),
    plans: cleanItems(plans),
    tombstones,
    themeSettings: value.themeSettings && typeof value.themeSettings === "object" ? value.themeSettings : null,
    sharedThemeSettings: value.sharedThemeSettings && typeof value.sharedThemeSettings === "object" ? value.sharedThemeSettings : null,
    wallpaper: value.wallpaper && typeof value.wallpaper === "object" ? value.wallpaper : null,
    profile: value.profile && typeof value.profile === "object" ? value.profile : {},
    preferences: value.preferences && typeof value.preferences === "object" ? value.preferences : {},
    updatedAt: Date.now()
  };
}
function validatePlaceId(value) {
  const id = String(value || "");
  if (!/^places\/[A-Za-z0-9_-]{5,160}$/.test(id) && !/^[A-Za-z0-9_-]{5,160}$/.test(id)) throw new Error("INVALID_PLACE_ID");
  return id.startsWith("places/") ? id : "places/" + id;
}
async function placesRequest(url, env, options) {
  if (!env.GOOGLE_MAPS_API_KEY) throw new Error("PLACES_NOT_CONFIGURED");
  const headers = { "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY, ...(options && options.headers || {}) };
  return fetch(url, { ...(options || {}), headers });
}
async function sendJsonPush(subscription, payload, env) {
  const endpoint = new URL(subscription.endpoint);
  const allowedHosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com", "web.push.apple.com"];
  if (!allowedHosts.some(host => endpoint.hostname === host || endpoint.hostname.endsWith("." + host))) throw new Error("UNSUPPORTED_PUSH_HOST");
  const uaPublic = b64urlToBytes(subscription.p256dh);
  const authSecret = b64urlToBytes(subscription.auth);
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const clientPublicKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, serverKeys.privateKey, 256));
  const authKey = await crypto.subtle.importKey("raw", authSecret, "HKDF", false, ["deriveBits"]);
  const info = new Uint8Array([...encoder.encode("WebPush: info\0"), ...uaPublic, ...serverPublic]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sharedSecret, info }, authKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const contentKeyBytes = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("Content-Encoding: aes128gcm") }, ikmKey, 128));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("Content-Encoding: nonce") }, ikmKey, 96));
  const contentKey = await crypto.subtle.importKey("raw", contentKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = new Uint8Array([...encoder.encode(JSON.stringify(payload)), 2]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, contentKey, plain));
  const header = new Uint8Array(21 + serverPublic.length);
  header.set(salt, 0);
  header.set([0, 0, 16, 0], 16);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0); body.set(ciphertext, header.length);

  const privateJwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const vapidKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = encodeB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const jwtPayload = encodeB64url(JSON.stringify({ aud: endpoint.origin, exp: now + 3600, sub: env.VAPID_SUBJECT || "mailto:admin@example.invalid" }));
  const unsigned = jwtHeader + "." + jwtPayload;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapidKey, encoder.encode(unsigned)));
  const token = unsigned + "." + bytesToB64url(signature);
  return fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "TTL": "86400",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": "vapid t=" + token + ", k=" + env.VAPID_PUBLIC_KEY
    },
    body
  });
}
async function notifyUser(env, userSub, notification) {
  const rows = await env.DB.prepare("SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_sub = ?").bind(userSub).all();
  for (const row of rows.results || []) {
    try {
      const response = await sendJsonPush(row, notification, env);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(row.endpoint).run();
      }
    } catch (error) {
      console.warn("Push delivery failed", error && error.message);
    }
  }
}
function extractOutputText(result) {
  if (typeof result.output_text === "string") return result.output_text;
  const parts = [];
  for (const item of result.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) parts.push(content.text);
  return parts.join("\n");
}
async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true, service: "goplan-api", version: "1.0.0", time: new Date().toISOString() });
  }
  if (request.method === "GET" && path === "/api/config") {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || "", vapidPublicKey: env.VAPID_PUBLIC_KEY || "", features: { ai: !!env.OPENAI_API_KEY, places: !!env.GOOGLE_MAPS_API_KEY, push: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK), cloudSync: !!env.DB } });
  }
  // Photo proxy is intentionally public because HTML image requests cannot attach the app's Bearer token.
  // Restrict the path to Places photo resource names and keep the Google API key on the server.
  if (request.method === "GET" && path === "/api/places/photo") {
    const name = String(url.searchParams.get("name") || "");
    if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) return json({ error: "INVALID_PHOTO" }, 400);
    const response = await placesRequest(PLACES_BASE + "/" + name + "/media?maxWidthPx=900", env);
    if (!response.ok) return json({ error: "PHOTO_UNAVAILABLE" }, 502);
    const headers = new Headers({ "Cache-Control": "public, max-age=86400", "Content-Type": response.headers.get("Content-Type") || "image/jpeg" });
    return new Response(response.body, { status: 200, headers });
  }
  const user = await requireUser(request, env);
  await env.DB.prepare("INSERT INTO users (user_sub,email,display_name,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_sub) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,updated_at=excluded.updated_at")
    .bind(user.sub, user.email, user.name, Date.now()).run();

  if (request.method === "GET" && path === "/api/me") {
    const usage = await env.DB.prepare("SELECT count FROM ai_usage WHERE user_sub=? AND usage_date=?").bind(user.sub, new Date().toISOString().slice(0, 10)).first();
    return json({ user: { email: user.email, name: user.name, picture: user.picture }, aiUsageCount: usage ? usage.count : 0 });
  }
  if (request.method === "GET" && path === "/api/sync") {
    const row = await env.DB.prepare("SELECT revision,payload_json,updated_at FROM sync_state WHERE user_sub=?").bind(user.sub).first();
    return json({ revision: row ? row.revision : 0, data: row ? JSON.parse(row.payload_json) : null, updatedAt: row ? row.updated_at : null });
  }
  if (request.method === "PUT" && path === "/api/sync") {
    const body = await readJson(request, 900000);
    const baseRevision = Number(body.revision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) return json({ error: "INVALID_REVISION" }, 400);
    const payload = safePayload(body.data);
    const text = JSON.stringify(payload);
    if (text.length > 850000) return json({ error: "DATA_TOO_LARGE" }, 413);
    const now = Date.now();
    const result = await env.DB.prepare(
      "INSERT INTO sync_state (user_sub,revision,payload_json,updated_at) VALUES (?,?,?,?) " +
      "ON CONFLICT(user_sub) DO UPDATE SET revision=sync_state.revision+1,payload_json=excluded.payload_json,updated_at=excluded.updated_at " +
      "WHERE sync_state.revision=?"
    ).bind(user.sub, baseRevision + 1, text, now, baseRevision).run();
    if (!result.meta || result.meta.changes !== 1) {
      const latest = await env.DB.prepare("SELECT revision,payload_json,updated_at FROM sync_state WHERE user_sub=?").bind(user.sub).first();
      return json({ error: "SYNC_CONFLICT", revision: latest ? latest.revision : 0, data: latest ? JSON.parse(latest.payload_json) : null }, 409);
    }
    return json({ ok: true, revision: baseRevision + 1, updatedAt: now });
  }
  if (request.method === "POST" && path === "/api/plani/chat") {
    if (!env.OPENAI_API_KEY) return json({ error: "AI_NOT_CONFIGURED", message: "PLANI AIのサーバー設定がまだ完了していません。" }, 503);
    const body = await readJson(request, 30000);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
    if (!messages.length) return json({ error: "EMPTY_MESSAGE" }, 400);
    const cleanMessages = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000)
    })).filter(m => m.content);
    const today = new Intl.DateTimeFormat("ja-JP", { dateStyle: "full", timeZone: "Asia/Tokyo" }).format(new Date());
    const input = [{ role: "system", content: "あなたはGoPlanの外出計画アシスタント「PLANI」です。日本語で、中学生にも分かる明るく落ち着いた言葉で答えます。今日の日付は" + today + "です。営業時間・料金・運行状況など変わる情報を答える場合はWeb検索を使い、根拠と確認日を示します。確かでない情報を作らず、分からないと明記します。予定を作るときは場所、日付、移動時間、営業時間を考慮し、確認していない営業時間や予約可能性を断定しません。勝手に保存や変更をしたとは言いません。ユーザーが場所を探している場合は、候補の比較ポイントを整理し、GoPlanの場所検索も使うよう案内します。" }, ...cleanMessages];
    const usageDate = new Date().toISOString().slice(0, 10);
    const usageResult = await env.DB.prepare("INSERT INTO ai_usage (user_sub,usage_date,count) VALUES (?,?,1) ON CONFLICT(user_sub,usage_date) DO UPDATE SET count=count+1 WHERE count<40").bind(user.sub, usageDate).run();
    if (!usageResult.meta || usageResult.meta.changes !== 1) return json({ error: "DAILY_LIMIT", message: "今日はPLANIの利用上限に達しました。明日また使えます。" }, 429);
    const response = await fetch(OPENAI_RESPONSES, {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-6.2-astra", tools: [{ type: "web_search" }], input, max_output_tokens: 1200 })
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI request failed", response.status, JSON.stringify(result).slice(0, 500));
      return json({ error: "AI_PROVIDER_ERROR", message: "PLANIの応答に失敗しました。設定や通信を確認してください。" }, 502);
    }
    return json({ reply: extractOutputText(result), usageCount: usageResult.meta.changes ? (await env.DB.prepare("SELECT count FROM ai_usage WHERE user_sub=? AND usage_date=?").bind(user.sub, usageDate).first()).count : 0 });
  }
  if (request.method === "POST" && path === "/api/places/search") {
    const body = await readJson(request, 12000);
    const query = String(body.query || "").trim().slice(0, 300);
    if (!query) return json({ error: "QUERY_REQUIRED" }, 400);
    const response = await placesRequest(PLACES_BASE + "/places:searchText", env, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.photos" },
      body: JSON.stringify({ textQuery: query, languageCode: "ja", maxResultCount: 8 })
    });
    const data = await response.json();
    if (!response.ok) return json({ error: "PLACES_PROVIDER_ERROR", message: "場所の検索に失敗しました。" }, 502);
    const places = (data.places || []).map(p => ({
      id: p.id,
      name: p.displayName && p.displayName.text || "名称不明",
      address: p.formattedAddress || "",
      rating: p.rating || null,
      ratingCount: p.userRatingCount || 0,
      mapsUrl: p.googleMapsUri || "",
      photoUrl: p.photos && p.photos[0] ? "/api/places/photo?name=" + encodeURIComponent(p.photos[0].name) : ""
    }));
    return json({ places });
  }
  if (request.method === "GET" && path === "/api/places/watch") {
    const rows = await env.DB.prepare("SELECT id,place_id,place_name,created_at,last_change FROM place_watches WHERE user_sub=? ORDER BY created_at DESC").bind(user.sub).all();
    return json({ watches: rows.results || [] });
  }
  if (request.method === "POST" && path === "/api/places/watch") {
    const body = await readJson(request, 8000);
    const placeId = validatePlaceId(body.placeId);
    const placeName = String(body.name || "").trim().slice(0, 200);
    if (!placeName) return json({ error: "NAME_REQUIRED" }, 400);
    const existing = await env.DB.prepare("SELECT id FROM place_watches WHERE user_sub=? AND place_id=?").bind(user.sub, placeId).first();
    if (existing) return json({ ok: true, id: existing.id, exists: true });
    const details = await placesRequest(PLACES_BASE + "/" + placeId, env, { headers: { "X-Goog-FieldMask": "id,displayName,businessStatus,regularOpeningHours.weekdayDescriptions" } });
    const snapshot = details.ok ? await details.json() : {};
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO place_watches (id,user_sub,place_id,place_name,snapshot_json,created_at,last_change) VALUES (?,?,?,?,?,?,?)")
      .bind(id, user.sub, placeId, placeName, JSON.stringify(snapshot), Date.now(), null).run();
    return json({ ok: true, id });
  }
  if (request.method === "DELETE" && path.startsWith("/api/places/watch/")) {
    const id = path.split("/").pop();
    await env.DB.prepare("DELETE FROM place_watches WHERE id=? AND user_sub=?").bind(id, user.sub).run();
    return json({ ok: true });
  }
  if (request.method === "POST" && path === "/api/push/register") {
    const body = await readJson(request, 10000);
    const endpoint = String(body.endpoint || "");
    const keys = body.keys || {};
    if (!endpoint.startsWith("https://") || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return json({ error: "INVALID_SUBSCRIPTION" }, 400);
    const host = new URL(endpoint).hostname;
    const validHosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com", "web.push.apple.com"];
    if (!validHosts.some(h => host === h || host.endsWith("." + h))) return json({ error: "UNSUPPORTED_PUSH_HOST" }, 400);
    await env.DB.prepare("INSERT INTO push_subscriptions (id,user_sub,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_sub=excluded.user_sub,p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at")
      .bind(crypto.randomUUID(), user.sub, endpoint, keys.p256dh, keys.auth, Date.now()).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE" && path === "/api/push/register") {
    const body = await readJson(request, 5000);
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_sub=?").bind(String(body.endpoint || ""), user.sub).run();
    return json({ ok: true });
  }
  if (request.method === "POST" && path === "/api/account/delete") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM push_subscriptions WHERE user_sub=?").bind(user.sub),
      env.DB.prepare("DELETE FROM place_watches WHERE user_sub=?").bind(user.sub),
      env.DB.prepare("DELETE FROM sync_state WHERE user_sub=?").bind(user.sub),
      env.DB.prepare("DELETE FROM ai_usage WHERE user_sub=?").bind(user.sub),
      env.DB.prepare("DELETE FROM users WHERE user_sub=?").bind(user.sub)
    ]);
    return json({ ok: true });
  }
  return json({ error: "NOT_FOUND" }, 404);
}

async function checkPlaceWatches(env) {
  if (!env.GOOGLE_MAPS_API_KEY) return;
  const rows = await env.DB.prepare("SELECT id,user_sub,place_id,place_name,snapshot_json FROM place_watches ORDER BY created_at ASC LIMIT 100").all();
  for (const watch of rows.results || []) {
    try {
      const response = await placesRequest(PLACES_BASE + "/" + watch.place_id, env, {
        headers: { "X-Goog-FieldMask": "id,displayName,businessStatus,regularOpeningHours.weekdayDescriptions" }
      });
      if (!response.ok) continue;
      const current = await response.json();
      const comparable = {
        name: current.displayName && current.displayName.text || watch.place_name,
        businessStatus: current.businessStatus || "",
        hours: current.regularOpeningHours && current.regularOpeningHours.weekdayDescriptions || []
      };
      const previousRaw = watch.snapshot_json || "{}";
      let previous = {};
      try { previous = JSON.parse(previousRaw); } catch {}
      const prevComparable = {
        name: previous.displayName && previous.displayName.text || watch.place_name,
        businessStatus: previous.businessStatus || "",
        hours: previous.regularOpeningHours && previous.regularOpeningHours.weekdayDescriptions || []
      };
      if (JSON.stringify(comparable) !== JSON.stringify(prevComparable)) {
        await env.DB.prepare("UPDATE place_watches SET snapshot_json=?,last_change=? WHERE id=?").bind(JSON.stringify(current), Date.now(), watch.id).run();
        await notifyUser(env, watch.user_sub, {
          title: "GoPlan｜保存した場所の情報が更新されました",
          body: comparable.name + " の営業情報に変更が見つかりました。最新情報を確認してください。",
          url: "https://kwakebe2781.github.io/outing-manager/"
        });
      }
    } catch (error) { console.warn("Place watch failed", watch.id, error && error.message); }
  }
}
function localDateTime(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: map.year + "-" + map.month + "-" + map.day, minute: Number(map.hour) * 60 + Number(map.minute) };
}
async function sendPlanReminders(env, now) {
  const rows = await env.DB.prepare("SELECT user_sub,payload_json FROM sync_state").all();
  for (const row of rows.results || []) {
    try {
      const data = JSON.parse(row.payload_json);
      const prefs = data.preferences || {};
      if (prefs.planNotifications === false) continue;
      const zone = String(prefs.timeZone || "Asia/Tokyo");
      const local = localDateTime(zone, now);
      for (const plan of data.plans || []) {
        if (!plan || !plan.id || !plan.date || !plan.time || plan.date !== local.date) continue;
        const hm = String(plan.time).split(":").map(Number);
        if (hm.length !== 2 || !Number.isFinite(hm[0]) || !Number.isFinite(hm[1])) continue;
        const diff = hm[0] * 60 + hm[1] - local.minute;
        if (diff < 25 || diff > 35) continue;
        const reminderKey = row.user_sub + ":" + plan.id + ":" + plan.date;
        const insert = await env.DB.prepare("INSERT OR IGNORE INTO sent_reminders (reminder_key,sent_at) VALUES (?,?)").bind(reminderKey, Date.now()).run();
        if (insert.meta && insert.meta.changes === 1) {
          await notifyUser(env, row.user_sub, {
            title: "GoPlan｜おでかけまであと30分",
            body: String(plan.title || "予定") + " の予定時刻が近づいています。",
            url: "https://kwakebe2781.github.io/outing-manager/"
          });
        }
      }
    } catch (error) { console.warn("Plan reminder failed", error && error.message); }
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), request, env);
    if (!new URL(request.url).pathname.startsWith("/api/")) return new Response("GoPlan API", { status: 200 });
    try {
      const response = await handleApi(request, env, ctx);
      return withCors(response, request, env);
    } catch (error) {
      const code = error && error.message || "INTERNAL_ERROR";
      const status = code === "AUTH_REQUIRED" || code.startsWith("INVALID_") || code === "TOKEN_EXPIRED" || code === "INVALID_SIGNATURE" || code === "INVALID_AUDIENCE" ? 401 :
        code === "REQUEST_TOO_LARGE" ? 413 : code === "SYNC_CONFLICT" ? 409 :
        code.endsWith("_NOT_CONFIGURED") || code === "GOOGLE_CERTS_UNAVAILABLE" ? 503 : 500;
      console.error("GoPlan API error", code);
      return withCors(json({ error: code, message: status === 401 ? "Googleアカウントでログインしてください。" : "処理に失敗しました。設定と通信を確認してください。" }, status), request, env);
    }
  },
  async scheduled(controller, env, ctx) {
    await checkPlaceWatches(env);
    await sendPlanReminders(env, new Date(controller.scheduledTime));
  }
};