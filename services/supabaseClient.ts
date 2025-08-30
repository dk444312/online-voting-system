
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycjhhdhalisencahifsq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljamhoZGhhbGlzZW5jYWhpZnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjgyMTIsImV4cCI6MjA3MDY0NDIxMn0.wRDFiWOAZWKD8ztSeCE2hKlKndtg1XXa2b6C0HIPI_s';

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
