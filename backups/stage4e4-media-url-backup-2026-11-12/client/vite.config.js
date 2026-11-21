
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Hosts that only work in local development.
const DEV_ONLY_HOSTS = [
  '10.0.2.2',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
];

// Validate production API URL.
function assertProductionApiUrl(apiUrl) {
  if (!apiUrl || !apiUrl.trim()) {
    throw new Error(
      '\n[build] VITE_API_URL is required for production.\n' +
      'Set it in client/.env.production.\n'
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(apiUrl.trim());
  } catch {
    throw new Error(
      `\n[build] Invalid VITE_API_URL: "${apiUrl}"\n`
    );
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(
      `[build] Production API must use HTTPS: ${apiUrl}`
    );
  }

  if (DEV_ONLY_HOSTS.includes(parsedUrl.hostname)) {
    throw new Error(
      `[build] Development-only API host is not allowed: ${parsedUrl.hostname}`
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(
      '[build] API URL must not contain embedded credentials.'
    );
  }
}

// Capacitor configuration path.
const CAPACITOR_CONFIG_PATH = fileURLToPath(
  new URL('./capacitor.config.json', import.meta.url)
);

// Generate Capacitor configuration according to build mode.
function buildCapacitorConfig(mode) {
  const isProduction = mode === 'production';

  return {
    appId: 'com.sarthak.customerrewards',
    appName: 'VP52',
    webDir: 'dist',

    server: {
      androidScheme: isProduction ? 'https' : 'http',
      cleartext: !isProduction,
    },
  };
}

// Write the correct Capacitor configuration after each build.
function writeCapacitorConfigPlugin(mode) {
  return {
    name: 'write-capacitor-config',
    apply: 'build',

    closeBundle() {
      const config = buildCapacitorConfig(mode);

      writeFileSync(
        CAPACITOR_CONFIG_PATH,
        `${JSON.stringify(config, null, 2)}\n`
      );

      console.log(
        `[Capacitor] Generated ${mode} configuration.`
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Validate only actual production builds.
  if (command === 'build' && mode === 'production') {
    assertProductionApiUrl(env.VITE_API_URL);
  }

  return {
    plugins: [
      react(),
      writeCapacitorConfigPlugin(mode),
    ],

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
