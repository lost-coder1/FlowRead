/**
 * One-time build script: download WordNet JSON from fluhus/wordnet-to-json
 * and transform it to the compact FlowRead dictionary format.
 *
 * Usage: node scripts/build-dict.js
 * Output: www/assets/dictionary/dict.json
 *
 * Source: https://github.com/fluhus/wordnet-to-json (WordNet License, permissive)
 */

'use strict';

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const RELEASE_URL = 'https://github.com/fluhus/wordnet-to-json/releases/latest/download/wordnet.json.gz';
const OUTPUT_PATH = path.join(__dirname, '../www/assets/dictionary/dict.json');
const MAX_DEFS_PER_WORD = 2;
const MAX_DEF_CHARS = 120;

/* WordNet POS codes: n=noun, v=verb, a=adjective, s=adjective satellite, r=adverb */
const POS_SHORT = {
  n: 'n',
  v: 'v',
  a: 'adj',
  s: 'adj',
  r: 'adv',
  noun: 'n',
  verb: 'v',
  adjective: 'adj',
  adjective_satellite: 'adj',
  adverb: 'adv',
};

function downloadWithRedirects(url, redirectsLeft) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { 'User-Agent': 'FlowRead-DictBuilder/1.0' } }, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        if (!redirectsLeft) return reject(new Error('Too many redirects'));
        res.resume();
        return resolve(downloadWithRedirects(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading WordNet JSON from GitHub releases…');
  console.log('URL:', RELEASE_URL);

  const res = await downloadWithRedirects(RELEASE_URL);

  console.log('Download started. Decompressing…');

  const chunks = [];
  await new Promise(function(resolve, reject) {
    const gunzip = zlib.createGunzip();
    res.pipe(gunzip);
    gunzip.on('data', function(chunk) { chunks.push(chunk); });
    gunzip.on('end', resolve);
    gunzip.on('error', reject);
    res.on('error', reject);
  });

  const raw = Buffer.concat(chunks).toString('utf8');
  console.log('Decompressed size:', (raw.length / 1024 / 1024).toFixed(2), 'MB');

  let source;
  try {
    source = JSON.parse(raw);
  } catch (e) {
    throw new Error('Failed to parse JSON: ' + e.message);
  }

  console.log('Transforming to compact format…');

  const dict = Object.create(null);
  let wordCount = 0;

  /* Format: { synset: { id: { pos, word: [...synonyms], gloss, ... } } }
     Invert: for each synset, add the gloss to every word in the synset's word array */
  const synsets = source.synset || source;

  for (const id of Object.keys(synsets)) {
    const synset = synsets[id];
    const rawPos = synset.pos || '';
    const rawDef = synset.gloss || synset.def || synset.definition || '';
    const words = Array.isArray(synset.word) ? synset.word : (synset.lemma ? [synset.lemma] : []);

    if (!rawDef || !words.length) continue;

    const pos = POS_SHORT[rawPos] || POS_SHORT[rawPos.toLowerCase()] || rawPos.slice(0, 3) || '?';
    /* Strip example usages in parentheses or after semicolons, truncate long defs */
    let def = rawDef.split(';')[0].replace(/\([^)]+\)/g, '').replace(/\s+/g, ' ').trim();
    if (!def) continue;
    if (def.length > MAX_DEF_CHARS) def = def.slice(0, MAX_DEF_CHARS).replace(/\s+\S*$/, '') + '…';
    /* Skip multi-word entries (not typically looked up mid-reading) */


    for (const word of words) {
      const key = word.toLowerCase().replace(/_/g, ' ');
      /* Skip multi-word expressions and entries with special characters */
      if (key.includes(' ') || /[^a-z'-]/.test(key)) continue;
      if (!dict[key]) {
        dict[key] = [];
        wordCount++;
      }
      if (dict[key].length < MAX_DEFS_PER_WORD) {
        dict[key].push({ pos, def });
      }
    }
  }

  const output = JSON.stringify(dict);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');

  const sizeMB = (output.length / 1024 / 1024).toFixed(2);
  console.log('Done.');
  console.log('Words written:', wordCount.toLocaleString());
  console.log('Output size:', sizeMB, 'MB');
  console.log('Output path:', OUTPUT_PATH);
  console.log('');
  console.log('Sample entries:');
  const sampleKeys = Object.keys(dict).slice(0, 3);
  sampleKeys.forEach(function(k) { console.log(' ', k, '->', JSON.stringify(dict[k])); });
}

main().catch(function(err) {
  console.error('ERROR:', err.message);
  process.exit(1);
});
