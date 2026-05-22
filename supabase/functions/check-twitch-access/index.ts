// @ts-nocheck
/*
 * check-twitch-access — Supabase Edge Function
 * --------------------------------------------
 * Verifica se l'utente loggato (via Twitch OAuth Supabase) è follower
 * del broadcaster configurato. Il check sub è client-side col token
 * utente — qui facciamo solo il follower check perché richiede l'app
 * token del broadcaster (scope diverso, non ottenibile dall'utente).
 *
 * Input:  Authorization: Bearer <supabase jwt>
 *         Body: { twitch_id: "1234567" }   (opzionale, viene anche dedotto dal JWT)
 *
 * Output: { isFollower: bool, twitchId: string }
 *
 * Env vars richieste:
 *   TWITCH_CLIENT_ID
 *   TWITCH_CLIENT_SECRET
 *   TWITCH_BROADCASTER_ID
 *   SUPABASE_URL (auto)
 *   SUPABASE_SERVICE_ROLE_KEY (auto)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWITCH_CLIENT_ID     = Deno.env.get('TWITCH_CLIENT_ID');
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
const BROADCASTER_ID       = Deno.env.get('TWITCH_BROADCASTER_ID');

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* Cache in memoria dell'app access token (vive finché la function instance vive) */
let cachedAppToken: string | null = null;
let tokenExpiresAt = 0;

async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < tokenExpiresAt - 30_000) {
    return cachedAppToken;
  }
  const url = 'https://id.twitch.tv/oauth2/token'
            + `?client_id=${encodeURIComponent(TWITCH_CLIENT_ID)}`
            + `&client_secret=${encodeURIComponent(TWITCH_CLIENT_SECRET)}`
            + '&grant_type=client_credentials';
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch token fetch failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  cachedAppToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  return cachedAppToken;
}

async function checkFollower(userId: string): Promise<boolean> {
  const token = await getAppAccessToken();
  const url = 'https://api.twitch.tv/helix/channels/followers'
            + `?broadcaster_id=${encodeURIComponent(BROADCASTER_ID)}`
            + `&user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      'Client-Id':     TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    console.error(`Twitch followers API failed: ${res.status} ${await res.text()}`);
    return false;
  }
  const json = await res.json();
  return Array.isArray(json.data) && json.data.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Verifica config
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !BROADCASTER_ID) {
      throw new Error('Missing Twitch env vars (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET / TWITCH_BROADCASTER_ID)');
    }

    // Verifica JWT Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) throw new Error('Invalid Supabase session');

    // Twitch ID — preferenza body, fallback metadata
    let body: any = {};
    try { body = await req.json(); } catch {}
    const twitchId = String(
      body.twitch_id
      ?? user.user_metadata?.provider_id
      ?? user.user_metadata?.sub
      ?? ''
    );
    if (!twitchId) throw new Error('No Twitch user id found in session');

    const isFollower = await checkFollower(twitchId);

    return new Response(
      JSON.stringify({ isFollower, twitchId }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[check-twitch-access]', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e), isFollower: false }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
