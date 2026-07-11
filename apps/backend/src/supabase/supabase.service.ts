import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import supabaseConfig from '../config/supabase.config';

export type SupabaseClientType = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClientType;

  constructor(
    @Inject(supabaseConfig.KEY)
    private readonly config: ConfigType<typeof supabaseConfig>,
  ) {
    this.client = createClient(this.config.url, this.config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
}
