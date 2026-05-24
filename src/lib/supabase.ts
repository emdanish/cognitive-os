import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key not set in env");
  }
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}

export function getServerSupabase(): SupabaseClient {
  if (!url || !(serviceKey || anonKey)) {
    throw new Error("Supabase URL or key not set in env");
  }
  if (!serverClient) {
    serverClient = createClient(url, serviceKey || anonKey!, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}
