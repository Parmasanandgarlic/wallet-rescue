import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const findings = [];
const literalHexKey = /(?:0x)?[0-9a-fA-F]{64}/g;
const keyContext = /(?:private|secret|clean|compromised|wallet)[_ -]?(?:key|pk)|privateKeyToAccount/i;
const forbiddenFile = /(^|\/)(?:\.env(?:\..+)?|credentials\.json|service-account[^/]*\.json|[^/]+\.(?:pem|p12|pfx|key))$/i;

for (const file of files) {
  const normalized = file.replace(/\\/g, '/');
  if (forbiddenFile.test(normalized) && path.posix.basename(normalized) !== '.env.example') {
    findings.push(`${normalized}: credential-bearing file is tracked`);
  }

  let stat;
  try { stat = fs.statSync(file); } catch { continue; }
  if (!stat.isFile() || stat.size > 1024 * 1024) continue;

  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(literalHexKey)];
    if (matches.length && keyContext.test(line)) {
      findings.push(`${normalized}:${index + 1}: probable literal private key`);
    }
    keyContext.lastIndex = 0;
  });
}

if (findings.length) {
  console.error('Security audit failed:');
  findings.forEach((finding) => console.error(` - ${finding}`));
  process.exit(1);
}

console.log(`Security audit passed (${files.length} tracked files checked).`);
