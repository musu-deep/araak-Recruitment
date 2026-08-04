import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const bundleFiles = [
  'bundle/v2-0.txt',
  'bundle/v2-1.txt',
  'bundle/v2-2.txt'
];

const encoded = bundleFiles
  .map((file) => readFileSync(file, 'utf8').replace(/\s+/g, ''))
  .join('');

let compressed;
let html;
try {
  // Node's decoder safely tolerates the legacy chunk formatting. We then
  // re-encode the decoded bytes into one canonical Base64 file so browsers'
  // strict atob() implementation can decode it without InvalidCharacterError.
  compressed = Buffer.from(encoded, 'base64');
  html = gunzipSync(compressed).toString('utf8');
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

const normalizedFile = 'bundle/v2-normalized.txt';
writeFileSync(normalizedFile, compressed.toString('base64'), 'utf8');

console.log(`Verified Araak recruitment bundle (${html.length} UTF-8 characters).`);
console.log(`Generated canonical browser bundle: ${normalizedFile}.`);
