import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mqmeadomjlxlzpasukzu.supabase.co";
const supabaseAnonKey = "sb_publishable__SfMvZcbBkaoNznTPI4lyg_x8eA81bw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
