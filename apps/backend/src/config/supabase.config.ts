import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const appEnv = process.env.APP_ENV ?? 'sim';

  const isProduction = appEnv === 'prod';

  const url = isProduction
    ? process.env.SUPABASE_PROD_URL
    : process.env.SUPABASE_SIM_URL;

  const publishableKey = isProduction
    ? process.env.SUPABASE_PROD_PUBLISHABLE_KEY
    : process.env.SUPABASE_SIM_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      `Konfigurasi Supabase ${appEnv.toUpperCase()} belum lengkap`,
    );
  }

  return {
    environment: appEnv,
    url,
    publishableKey,
  };
});
