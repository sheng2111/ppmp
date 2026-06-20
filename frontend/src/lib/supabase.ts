import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://mqmeadomjlxlzpasukzu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xbWVhZG9tamx4bHpwYXN1a3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjQ2NzYsImV4cCI6MjA5NjcwMDY3Nn0.GhYYGeOS0ARwS2X6JnUyAsgKUI3WpbDzE5BOQsq7H3k",
);
