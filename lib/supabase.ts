// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nczyzftwbbbglvmcrntb.supabase.co'; // ضع رابط Supabase هنا
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jenl6ZnR3YmJiZ2x2bWNybnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTI4OTYsImV4cCI6MjA2NzkyODg5Nn0.gRnEs6ylQMoPEqS8i3e7QDPGIW8HzG4a4g0-Ijy-t58'; // ضع مفتاح anon من إعدادات Supabase

export const supabase = createClient(supabaseUrl, supabaseAnonKey);