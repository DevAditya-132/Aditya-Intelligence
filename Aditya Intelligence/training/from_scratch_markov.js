/*
  A dependency-free character n-gram language model. It learns transitions
  from local text and writes an inspectable JSON checkpoint. This is a real
  model trained from scratch, intentionally tiny and educational.
*/
const fs = require('fs');
const path = require('path');

function option(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }
const input = option('--text', 'sample_corpus.txt');
const output = option('--output', 'runs/aditya-tiny-markov.json');
const order = Number(option('--order', '4'));
if (!Number.isInteger(order) || order < 1 || order > 8) throw new Error('--order must be an integer from 1 to 8');
const text = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n');
if (text.length < order + 20) throw new Error('Training text is too short.');
const counts = {};
for (let i = 0; i < text.length - order; i += 1) {
  const context = text.slice(i, i + order); const next = text[i + order];
  (counts[context] ??= {})[next] = (counts[context][next] ?? 0) + 1;
}
const transitions = Object.fromEntries(Object.entries(counts).map(([context, next]) => {
  const total = Object.values(next).reduce((a, b) => a + b, 0);
  return [context, Object.fromEntries(Object.entries(next).map(([c, n]) => [c, n / total]))];
}));
const model = { format: 'aditya-intelligence-tiny-markov-v1', trainedFromScratch: true, order, characters: text.length, contexts: Object.keys(transitions).length, transitions };
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(model));
console.log(`Trained from scratch on ${text.length} characters; saved ${Object.keys(transitions).length} contexts to ${output}`);
