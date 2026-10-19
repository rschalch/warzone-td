// Downloads the WW2 faction music from Wikimedia Commons (public-domain recordings only), converts it to
// loudness-matched MP3 with ffmpeg and writes the credits. Re-run after changing the list:
//   node scripts/fetch-music.mjs
// Output: public/music/<faction>/<file>.mp3, public/music/credits.json (read by the game) and CREDITS.md.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** [faction, our file name, shown name, Commons file title] */
const TRACKS = [
  ['de', 'horst-wessel-lied', 'Horst-Wessel-Lied', 'Horst-Wessel-Lied.ogg'],
  ['de', 'erika', 'Erika (Herms Niel)', 'Erika (Marching Song of the German Military).ogg'],
  ['de', 'preussens-gloria', 'Preußens Gloria (Piefke)', 'Preußens Gloria.wav'],
  ['de', 'badenweiler', 'Badenweiler Marsch (Fürst)', 'Badonviller - U.S. Marine Band.ogg'],
  ['de', 'walkuerenritt', 'Walkürenritt (Wagner)', 'Richard Wagner - Ride of the Valkyries.ogg'],
  ['de', 'deutschlandlied', 'Das Lied der Deutschen (Haydn)', 'National anthem of Germany - U.S. Army 1st Armored Division Band.ogg'],
  ['su', 'internationale', 'The Internationale', 'The Internationale (1977 instrumental).ogg'],
  ['su', 'sacred-war', 'The Sacred War (Alexandrov)', 'The Sacred War.ogg'],
  ['su', 'anthem-1944', 'State Anthem of the USSR (1944)', 'Gimn Sovetskogo Soyuza (1944 Vocal).ogg'],
  ['su', 'slavianka', 'Farewell of Slavianka (Agapkin)', 'Farewell of Slavianka.ogg'],
  ['us', 'star-spangled-banner', 'The Star-Spangled Banner', '"The Star-Spangled Banner" performed by the United States Navy Band.mp3'],
  ['us', 'stars-and-stripes', 'The Stars and Stripes Forever (Sousa)', 'John Philip Sousa - Stars and Stripes Forever.ogg'],
  ['us', 'battle-hymn', 'Battle Hymn of the Republic', '"The Battle Hymn of the Republic" US Air Force Band.ogg'],
  ['us', 'over-there', 'Over There (Cohan, 1917)', 'Over There (1917).mp3'],
  ['jp', 'kimigayo', 'Kimigayo', 'Kimi ga Yo instrumental.ogg'],
  ['jp', 'gunkan', 'Gunkan Kōshinkyoku (Setoguchi, 1913)', 'Gunkan kōshinkyoku (1913).ogg'],
  ['jp', 'umi-yukaba', 'Umi Yukaba', 'Umi Yukaba.ogg'],
];

const UA = { 'User-Agent': 'warzone-td-music-fetch/1.0 (https://github.com/rschalch/warzone-td; personal game project) node-fetch' };
const OUT = new URL('../public/music/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function get(url) {
  for (let k = 0; k < 6; k++) {
    await sleep(8000 + k * 30000); // Commons rate-limits bursts
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429) return res;
  }
  throw new Error(`rate limited: ${url}`);
}

async function info(title) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', titles: `File:${title}`,
    iiprop: 'url|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist|Credit|ImageDescription|DateTimeOriginal',
  });
  const page = Object.values((await (await get(`https://commons.wikimedia.org/w/api.php?${q}`)).json()).query.pages)[0];
  const ii = page.imageinfo?.[0];
  if (!ii) throw new Error(`not on Commons: ${title}`);
  const m = ii.extmetadata ?? {};
  return { url: ii.url, page: ii.descriptionurl, license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value), date: strip(m.DateTimeOriginal?.value) };
}

const credits = {};
const tmp = join(tmpdir(), 'wz-music');
mkdirSync(tmp, { recursive: true });
for (const [faction, file, name, title] of TRACKS) {
  const meta = await info(title);
  if (!/public domain|cc0|cc by/i.test(meta.license)) throw new Error(`${title}: licence "${meta.license}" is not free to redistribute`);
  const dir = join(OUT, faction);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, `${file}.mp3`);
  if (!existsSync(dest)) {
    const src = join(tmp, file + title.slice(title.lastIndexOf('.')));
    writeFileSync(src, Buffer.from(await (await get(meta.url)).arrayBuffer()));
    // mono, 96 kbit/s, every track at the same loudness
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-b:a', '96k', dest]);
    rmSync(src);
  }
  (credits[faction] ??= []).push({ file: `${faction}/${file}.mp3`, name, source: meta.page, license: meta.license, artist: meta.artist, date: meta.date });
  console.log(`${faction} ${name} — ${meta.license}`);
}
writeFileSync(join(OUT, 'credits.json'), JSON.stringify(credits, null, 1) + '\n');
const md = ['# Music credits', '', 'WW2 faction music: recordings from Wikimedia Commons, all in the public domain there. Downloaded and converted by `scripts/fetch-music.mjs`.', ''];
for (const [f, list] of Object.entries(credits)) {
  md.push(`## ${f}`, '');
  for (const t of list) md.push(`- **${t.name}** — ${t.artist || 'unknown performer'}${t.date ? ` (${t.date})` : ''}. ${t.license}. ${t.source}`);
  md.push('');
}
writeFileSync(join(OUT, 'CREDITS.md'), md.join('\n'));
