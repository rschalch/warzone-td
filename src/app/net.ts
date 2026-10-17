// Co-op networking: a WebRTC data channel between two browsers. PeerJS's public broker only helps
// the two find each other (the host shares a short room code); game traffic is peer to peer.

import type { DataConnection, Peer as PeerT } from 'peerjs';
import type { Link, NetMsg } from './session';

const PREFIX = 'wztd-room-';

export class NetLink implements Link {
  onMessage: ((msg: NetMsg) => void) | null = null;
  onClose: (() => void) | null = null;
  private queue: NetMsg[] = [];

  constructor(private readonly peer: PeerT, private readonly conn: DataConnection, readonly player: number) {
    conn.on('data', (d) => {
      const msg = d as NetMsg;
      if (this.onMessage) this.onMessage(msg);
      else this.queue.push(msg);
    });
    conn.on('close', () => this.onClose?.());
    conn.on('error', () => this.onClose?.());
  }

  /** Messages that arrived before anyone listened (e.g. the start message). */
  drain(): NetMsg[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  send(msg: NetMsg): void {
    if (this.conn.open) this.conn.send(msg);
  }

  close(): void {
    try {
      this.send({ m: 'bye' });
      this.conn.close();
      this.peer.destroy();
    } catch {
      // already gone
    }
  }
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let k = 0; k < 6; k++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function peerjs() {
  return (await import('peerjs')).Peer;
}

/** Opens a room. Resolves with the code at once; `connected` resolves when a guest joins. */
export async function host(): Promise<{ code: string; connected: Promise<NetLink>; cancel: () => void }> {
  const Peer = await peerjs();
  const code = randomCode();
  const peer = new Peer(PREFIX + code, { debug: 0 });
  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', (e) => reject(e));
  });
  const connected = new Promise<NetLink>((resolve) => {
    peer.on('connection', (conn) => {
      conn.on('open', () => resolve(new NetLink(peer, conn, 0)));
    });
  });
  return { code, connected, cancel: () => peer.destroy() };
}

export async function join(code: string): Promise<NetLink> {
  const Peer = await peerjs();
  const peer = new Peer({ debug: 0 });
  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', (e) => reject(e));
  });
  return new Promise((resolve, reject) => {
    const conn = peer.connect(PREFIX + code.trim().toUpperCase(), { reliable: true, serialization: 'json' });
    const timer = setTimeout(() => reject(new Error('No room with that code answered.')), 12000);
    conn.on('open', () => {
      clearTimeout(timer);
      resolve(new NetLink(peer, conn, 1));
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}
