import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mqmeadomjlxlzpasukzu.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable__SfMvZcbBkaoNznTPI4lyg_x8eA81bw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
