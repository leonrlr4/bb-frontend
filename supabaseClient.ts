import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zzbgloanoczmzrwbtitl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Ymdsb2Fub2N6bXpyd2J0aXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODQ3MjMsImV4cCI6MjA3NTk2MDcyM30.9043zm9mDpfFCXXXJV92Ftj-cK-gGsVRRtNhsVucmVo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
