#!/usr/bin/env node
/**
 * fetch_chkobba_cards.mjs
 * Downloads Wikimedia Commons Category:Chkobba into public/chkobba-cards/
 *
 *   node scripts/fetch_chkobba_cards.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'public', 'chkobba-cards');
const API = 'https://commons.wikimedia.org/w/api.php';
const CATEGORY = 'Category:Chkobba';
const UA =
  'DuoArcadeChkobbaFetcher/1.0 (https://github.com/lajmiyoussef78-star/DuoArcade; contact: lajmiyoussef78-star@users.noreply.github.com)';
const PERMISSIVE = new Set(['cc0', 'publicdomain', 'pd']);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function api(params) {
  const q = new URLSearchParams({ format: 'json', action: 'query', ...params });
  const res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

async function listCategory(cat) {
  const files = [];
  let cont = {};
  for (;;) {
    const data = await api({
      list: 'categorymembers',
      cmtitle: cat,
      cmtype: 'file',
      cmlimit: '500',
      ...cont
    });
    files.push(...data.query.categorymembers.map(m => m.title));
    if (!data.continue) return files;
    cont = data.continue;
  }
}

async function fileInfo(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await api({
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata'
    });
    for (const page of Object.values(data.query.pages)) {
      if (page.imageinfo?.[0]) out[page.title] = page.imageinfo[0];
    }
    await sleep(200);
  }
  return out;
}

function plain(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  console.log(`listing ${CATEGORY} ...`);
  const titles = await listCategory(CATEGORY);
  console.log(`  ${titles.length} files`);

  const info = await fileInfo(titles);
  const records = [];
  const review = [];

  for (const title of titles.slice().sort()) {
    const meta = info[title];
    if (!meta) {
      review.push(`${title}: no imageinfo returned`);
      continue;
    }
    const ext = meta.extmetadata || {};
    const lic = (ext.LicenseShortName?.value || '').trim();
    const licid = (ext.License?.value || '').trim().toLowerCase();
    const author = plain(ext.Artist?.value) || 'unknown';
    const licurl = (ext.LicenseUrl?.value || '').trim();
    const name = title.split(':').slice(1).join(':');
    // ASCII-safe filename (Wikimedia uses "trèfle")
    const safe = name.replace(/ /g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dest = path.join(OUTDIR, safe);

    if (!fs.existsSync(dest)) {
      let lastErr;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await fetch(meta.url, { headers: { 'User-Agent': UA } });
          if (res.status === 429) {
            await sleep(1500 * (attempt + 1));
            continue;
          }
          if (!res.ok) throw new Error(`download ${safe}: HTTP ${res.status}`);
          fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
          await sleep(350);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await sleep(1000 * (attempt + 1));
        }
      }
      if (lastErr) throw lastErr;
    }

    const rec = {
      file: safe,
      title,
      author,
      license: lic || 'UNKNOWN',
      license_id: licid || 'unknown',
      license_url: licurl,
      source: meta.descriptionurl || '',
      attribution_required: !PERMISSIVE.has(licid),
      share_alike: licid.includes('sa')
    };
    records.push(rec);
    if (!lic) review.push(`${title}: licence field empty — check the file page`);
    console.log(`  ${safe.padEnd(40)} ${PERMISSIVE.has(licid) ? 'free' : lic}`);
  }

  fs.writeFileSync(path.join(OUTDIR, 'licenses.json'), JSON.stringify(records, null, 2));

  const need = records.filter(r => r.attribution_required);
  let md = '# Card artwork credits\n\n';
  if (!need.length) {
    md += 'All card files are public domain / CC0. No attribution is legally required.\n';
  } else {
    md += 'Card artwork from Wikimedia Commons. Files below require credit under their licence.\n\n';
    for (const r of need) {
      md += `- **${r.file}** — ${r.author}, [${r.license}](${r.license_url}) — [source](${r.source})\n`;
    }
    if (need.some(r => r.share_alike)) {
      md +=
        '\n> Share-alike applies: any file you MODIFY must be redistributed under the same or a compatible licence.\n';
    }
  }
  fs.writeFileSync(path.join(OUTDIR, 'ATTRIBUTION.md'), md);
  fs.writeFileSync(
    path.join(OUTDIR, 'REVIEW.txt'),
    review.length ? review.join('\n') : 'Nothing flagged. Still spot-check a few file pages.\n'
  );

  const sa = records.filter(r => r.share_alike).length;
  const free = records.filter(r => !r.attribution_required).length;
  console.log(`\n${records.length} files -> ${OUTDIR}/`);
  console.log(`  ${free} with no conditions, ${sa} share-alike`);
  if (review.length) console.log(`  ${review.length} need manual review — see REVIEW.txt`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
