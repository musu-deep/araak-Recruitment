import { writeFileSync } from 'node:fs';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  throw new Error(`Missing required Render environment variables: ${missing.join(', ')}`);
}

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL.trim(),
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY.trim(),
  STORAGE_BUCKET: (process.env.STORAGE_BUCKET || 'employment-attachments').trim(),
  PROCESS_FUNCTION: (process.env.PROCESS_FUNCTION || 'process-recruitment-submission').trim(),
  ODOO_RECRUITMENT_ALIAS: (process.env.ODOO_RECRUITMENT_ALIAS || '').trim(),
  BUILD_TIME: new Date().toISOString()
};

const source = `window.__ARAAK_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(config)});\n`;
writeFileSync('runtime-config.js', source, 'utf8');
console.log('Generated runtime-config.js for Araak Recruitment.');
