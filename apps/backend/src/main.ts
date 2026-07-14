import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SupabaseService } from './supabase/supabase.service';
import { SupabaseMode } from './supabase/supabase.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // const appEnv = process.env.APP_ENV as SupabaseMode;

  // console.log('APP_ENV:', appEnv);

  // const supabaseService = app.get(SupabaseService);
  // const supabaseClient = supabaseService.getClient(appEnv);

  // const { data, error } = await supabaseClient.from('users').select('*');

  // console.log({ data, error });

  await app.listen(process.env.PORT ?? 4000);

  // const healthController = app.get(HealthController);

  // console.log('Health Controller : ', await healthController.checkDb());
}
bootstrap();
