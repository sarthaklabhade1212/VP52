import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Hosts that only work in local development (Android emulator alias / loopback).
// A production build must never bake one of these in as the API origin.
const DEV_ONLY_HOSTS = ['10.0.2.2', 'localhost', '127.0.0.1', '0.0.0.0'];

// Fail the build loudly when a production bundle is missing a real HTTPS API origin.
// Runs ONLY for `vite build` in production mode; the dev server and the Android
// emulator build (`vite build --mode development` / `npm run build:dev`) are exempt.
function assertProductionApiUrl(apiUrl) {
  if (!apiUrl || !apiUrl.trim()) {
    throw new Error(
      '\n[build] VITE_API_URL is required for a production build but was not set.\n' +
      '        Copy client/.env.production.example to client/.env.production and set your\n' +
      '        public HTTPS API origin, or pass VITE_API_URL=https://api.example.com to the build.\n' +
      '        (For an Android emulator build use: npm run build:dev)\n'
    );
  }
  let host = '';
  try {
    host = new URL(apiUrl).hostname;
  } catch (e) {
    throw new Error(`\n[build] VITE_API_URL is not a valid URL: "${apiUrl}"\n`);
  }
  if (DEV_ONLY_HOSTS.includes(host)) {
    throw new Error(
      `\n[build] VITE_API_URL points to development-only host "${host}", which is unreachable\n` +
      '        from a published app. Use your public HTTPS origin for production builds.\n' +
      '        (For an Android emulator build use: npm run build:dev)\n'
    );
  }
  if (!/^https:\/\//i.test(apiUrl.trim())) {
    throw new Error(
      `\n[build] VITE_API_URL must use https:// for production (got "${apiUrl}").\n`
    );
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Guard real production builds only. `command === 'serve'` (dev server) and
  // `mode === 'development'` (emulator build) intentionally keep using 10.0.2.2.
  if (command === 'build' && mode === 'production') {
    assertProductionApiUrl(env.VITE_API_URL);
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
