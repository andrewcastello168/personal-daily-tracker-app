import { Injectable } from '@nestjs/common';
import { supabaseClients, type SupabaseMode } from './supabase.config';

@Injectable()
export class SupabaseService {
  getClient(mode: SupabaseMode) {
    // let APP_ENV = process.env.APP_ENV;
    // console.log(APP_ENV);
    return supabaseClients[mode];
  }
}
