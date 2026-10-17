// Compact, shareable links: replays and hand-made maps travel in the URL hash as deflated JSON.

import type { LoggedCommand } from '../game/commands';
import type { GameConfig } from '../game/config';
import type { MapDef } from '../game/maps';

export interface Replay {
  v: 1;
  config: GameConfig;
  log: LoggedCommand[];
  result: { wave: number; score: number; win: boolean };
}

async function pack(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function unpack<T>(text: string): Promise<T> {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const buf = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text()) as T;
}

const base = () => `${location.origin}${location.pathname}`;

export async function replayLink(r: Replay): Promise<string> {
  return `${base()}#replay=${await pack(r)}`;
}

export async function mapLink(def: MapDef): Promise<string> {
  return `${base()}#map=${await pack(def)}`;
}

/** What the page was opened with, if anything. */
export async function readHash(): Promise<{ replay?: Replay; map?: MapDef; rmap?: string } | null> {
  const h = location.hash.slice(1);
  if (!h) return null;
  const [key, value] = [h.slice(0, h.indexOf('=')), h.slice(h.indexOf('=') + 1)];
  try {
    if (key === 'replay') return { replay: await unpack<Replay>(value) };
    if (key === 'map') return { map: await unpack<MapDef>(value) };
    if (key === 'rmap') return { rmap: decodeURIComponent(value) };
  } catch {
    // a damaged link: ignore it
  }
  return null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
