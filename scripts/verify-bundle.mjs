import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const bundleFiles = [
  'bundle/v3-0.txt',
  'bundle/v3-1.txt',
  'bundle/v3-2.txt'
];

const encoded = bundleFiles
  .map((file) => readFileSync(file, 'utf8').replace(/\s+/g, ''))
  .join('');

let html;
try {
  html = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
} catch (error) {
  throw new Error(`Recruitment bundle could not be decoded: ${error.message}`);
}

const requiredContent = [
  'نموذج طلب توظيف خارجي',
  'id="applicationForm"',
  'id="languageSelect"',
  'id="locationStatus"',
  'id="signatureCanvas"',
  'employment_applications',
  '<script defer>\n(() => {'
];

const missing = requiredContent.filter((value) => !html.includes(value));
if (missing.length) {
  throw new Error(`Recruitment bundle is incomplete. Missing: ${missing.join(', ')}`);
}

console.log(`Verified Araak recruitment bundle (${html.length} UTF-8 characters).`);
