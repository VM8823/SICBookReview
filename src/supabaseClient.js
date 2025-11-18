import { createClient } from '@supabase/supabase-js';

// ⚠️ SOSTITUISCI con i tuoi dati da Supabase → Settings → API
const supabaseUrl = 'https://ueglsrtvomqnlzshzzcr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ2xzcnR2b21xbmx6c2h6emNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDM1MTMsImV4cCI6MjA3ODk3OTUxM30.gexDJdgqIJgHsMvO_mYJW0E83ePhajWdbhGH_MQ5Bsw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
