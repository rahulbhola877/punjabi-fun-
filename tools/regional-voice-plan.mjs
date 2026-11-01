import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';

// Export the exact native scripts that the game displays. No network request,
// credentials or credit spend. Feed reviewed lines to the audio skill/provider.
const region = process.argv[2];
if (!['japan', 'china'].includes(region)) {
  console.error('Usage: node tools/regional-voice-plan.mjs japan|china [output.json]');
  process.exit(1);
}
const sourcePath = `src/alternate/${region}Map.ts`;
const source = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true);
const lines = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'regionalLine') {
    const values = node.arguments.map(a => ts.isStringLiteral(a) ? a.text : null);
    if (values.length !== 5 || values.some(v => v === null)) throw Error(`Non-literal dialogue in ${sourcePath}`);
    const [id, speaker, locale, text, translation] = values;
    lines.push({ id, speaker, locale, text, translation, scriptSha256: crypto.createHash('sha256').update(`${locale}\n${text}`).digest('hex'), status: 'unrecorded', nativeReviewRequired: true });
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!lines.length || new Set(lines.map(l => l.id)).size !== lines.length) throw Error('Missing or duplicate dialogue IDs');
const expectedLocale = region === 'japan' ? 'ja-JP' : 'zh-CN';
if (lines.some(l => l.locale !== expectedLocale)) throw Error(`Unexpected locale in ${region} script`);
const output = `${JSON.stringify({ region, sourcePath, generatedAudio: false, lines }, null, 2)}\n`;
if (process.argv[3]) fs.writeFileSync(process.argv[3], output);
else process.stdout.write(output);
