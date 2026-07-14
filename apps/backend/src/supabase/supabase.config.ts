import { createClient } from '@supabase/supabase-js';

const authOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export const supabaseClients = {
  // sim: createClient(
  //   process.env.SUPABASE_SIM_URL!,
  //   process.env.SUPABASE_SIM_PUBLISHABLE_KEY!,
  //   authOptions,
  // ),

  prod: createClient(
    process.env.SUPABASE_PROD_URL!,
    process.env.SUPABASE_PROD_PUBLISHABLE_KEY!,
    authOptions,
  ),
};

export type SupabaseMode = keyof typeof supabaseClients;
