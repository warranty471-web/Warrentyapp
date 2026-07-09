import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jxekfdvorfurbkkvuawb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4ZWtmZHZvcmZ1cmJra3Z1YXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjcxMjEsImV4cCI6MjA5OTE0MzEyMX0.r6qelkVAGAm2VVcVxbQPYqievXwXMF8G5oymE4bbr1w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
