import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

// Absolute path to the root Capacitor config (this vite.config.js lives in client/).
const CAPACITOR_CONFIG_PATH = fileURLToPath(new URL('./capacitor.config.json', import.meta.url));

// Build the Capacitor config object for a given Vite build mode.
//
// The Android WebView `androidScheme` is the ONLY value that varies, and it is
// what fixes the emulator mixed-content block:
//   • development / emulator build  (`npm run build:dev`, mode !== 'production')
//       androidScheme: 'http'  -> the app is served from http://localhost, so calls
//       to the local backend at http://10.0.2.2:5000 are http -> http and are NOT
//       blocked as "mixed content".
//   • production build             (`npm run build`, mode === 'production')
//       androidScheme: 'https' -> secure https://localhost origin. Production is
//       additionally forced to a real https API by assertProductionApiUrl() (below)
//       and by resolveBaseUrl() in src/utils/api.js — neither of which is relaxed here.
// `cleartext: true` is preserved in both modes (it permits the local http backend in
// development and is inert in production, where the API is https). appId / appName /
// webDir never change.
function buildCapacitorConfig(mode) {
  const isProduction = mode === 'production';
  return {
    appId: 'com.sarthak.customerrewards',
    appName: "VIP'S",
    webDir: 'dist',
    server: {
      androidScheme: isProduction ? 'https' : 'http',
      cleartext: true,
    },
  };
}

// Vite build plugin: regenerate capacitor.config.json to match the build mode so a
// subsequent `npx cap sync android` copies the correct Android WebView scheme into
// android/app/src/main/assets/capacitor.config.json. Runs for `vite build` only
// (both `build` and `build:dev`) — never for the dev server or preview.
function writeCapacitorConfigPlugin(mode) {
  return {
    name: 'write-capacitor-config',
    apply: 'build',
    closeBundle() {
      const config = buildCapacitorConfig(mode);
      writeFileSync(CAPACITOR_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Guard real production builds only. `command === 'serve'` (dev server) and
  // `mode === 'development'` (emulator build) intentionally keep using 10.0.2.2.
  if (command === 'build' && mode === 'production') {
    assertProductionApiUrl(env.VITE_API_URL);
  }

  return {
    plugins: [react(), writeCapacitorConfigPlugin(mode)],
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
