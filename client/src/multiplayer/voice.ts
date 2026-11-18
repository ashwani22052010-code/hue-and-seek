// Voice chat: WebRTC peer-to-peer audio between players in the same private room.
// The server only relays signalling. "Who hears me" is enforced by attaching the microphone track
// only to the chosen peers' senders, so excluded players receive no audio at all.
import type { PublicPlayer, RoomState } from '@shared/types';
import { useStore, type VoiceTarget, type VoiceUI } from '../store/useStore';
import { api } from './api';
import { audioContext } from '../audio/sound';

type Emit = (ev: string, data?: unknown) => void;
type Request = (ev: string, data?: unknown) => Promise<{ ok: boolean; error?: string }>;

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  offerer: boolean;
  transceiver: RTCRtpTransceiver | null;
  audio: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  createdAt: number;
  attempts: number;
}

const ACTIVE_PHASES = ['assign', 'prep', 'hunt', 'intermission'];
/** Caught hiders and late joiners are spectators during a running round. */
export const isVoiceSpectator = (p: PublicPlayer | undefined) => !!p && (p.team === 'none' || (p.team === 'hider' && p.caught));

let iceServers: RTCIceServer[] | null = null;
async function getIceServers(): Promise<RTCIceServer[]> {
  if (!iceServers) {
    try {
      iceServers = (await api<{ iceServers: RTCIceServer[] }>('/voice-config')).iceServers;
    } catch {
      iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }
  return iceServers;
}

const setVoice = (patch: Partial<VoiceUI>) => {
  const s = useStore.getState();
  s.set({ voice: { ...s.voice, ...patch } });
};

/** The players who should hear me right now, given my settings and the game rules. */
export function computeAudience(room: RoomState | null, myId: string | null, v: VoiceUI): string[] {
  if (!room || !myId || !v.on || !v.mic) return [];
  const me = room.players.find((p) => p.id === myId);
  if (!me) return [];
  const active = ACTIVE_PHASES.includes(room.phase);
  let list = room.players.filter((p) => p.id !== myId && p.voice?.on && p.connected);
  if (active && isVoiceSpectator(me)) list = list.filter((p) => isVoiceSpectator(p)); // no hints to players still in the round
  if (v.target === 'team' && active) list = list.filter((p) => p.team === me.team && isVoiceSpectator(p) === isVoiceSpectator(me));
  if (v.target === 'custom') list = list.filter((p) => v.custom.includes(p.id));
  return list.map((p) => p.id);
}

class VoiceManager {
  private emit: Emit = () => {};
  private request: Request = async () => ({ ok: false });
  private peers = new Map<string, Peer>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private room: RoomState | null = null;

  bind(emit: Emit, request: Request) {
    this.emit = emit;
    this.request = request;
  }

  get enabled() {
    return useStore.getState().voice.on;
  }

  private myId() {
    return useStore.getState().myId;
  }

  private publishState() {
    const v = useStore.getState().voice;
    this.emit('voice:state', { on: v.on, mic: v.on && v.mic });
  }

  /** Join voice chat (listen). The microphone is only requested when you turn it on. */
  async enable(): Promise<string | null> {
    if (this.enabled) return null;
    if (typeof RTCPeerConnection === 'undefined') return 'Voice chat is not supported in this browser';
    setVoice({ busy: true });
    audioContext()?.resume().catch(() => {});
    await getIceServers();
    const r = await this.request('voice:state', { on: true, mic: false });
    if (!r.ok) {
      setVoice({ busy: false });
      return r.error ?? 'Could not join voice chat';
    }
    setVoice({ on: true, mic: false, busy: false });
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 200);
    this.sync(useStore.getState().room);
    return null;
  }

  disable(notifyServer = true) {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.micAnalyser = null;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    const was = this.enabled;
    setVoice({ on: false, mic: false, speaking: {}, status: {}, hearsMe: [], busy: false });
    if (was && notifyServer) this.emit('voice:state', { on: false, mic: false });
  }

  async setMic(on: boolean): Promise<string | null> {
    if (on && !this.enabled) {
      const err = await this.enable();
      if (err) return err;
    }
    if (on && !this.micStream) {
      try {
        setVoice({ busy: true });
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const ctx = audioContext();
        if (ctx) {
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          ctx.createMediaStreamSource(this.micStream).connect(an);
          this.micAnalyser = an;
        }
      } catch {
        setVoice({ busy: false });
        return 'Microphone permission was denied. Allow the mic in your browser settings to talk.';
      } finally {
        setVoice({ busy: false });
      }
    }
    setVoice({ mic: on });
    this.publishState();
    this.route();
    return null;
  }

  setTarget(target: VoiceTarget) {
    try { localStorage.setItem('hue.voiceTarget', target); } catch { /* ignore */ }
    setVoice({ target });
    this.route();
  }

  toggleCustom(id: string) {
    const v = useStore.getState().voice;
    setVoice({ custom: v.custom.includes(id) ? v.custom.filter((x) => x !== id) : [...v.custom, id] });
    this.route();
  }

  toggleMute(id: string) {
    const v = useStore.getState().voice;
    const muted = v.muted.includes(id) ? v.muted.filter((x) => x !== id) : [...v.muted, id];
    setVoice({ muted });
    const p = this.peers.get(id);
    if (p?.audio) p.audio.muted = muted.includes(id);
  }

  /** Re-announce after a reconnect so the server and peers know we're still in voice. */
  resume() {
    if (this.enabled) {
      for (const id of [...this.peers.keys()]) this.closePeer(id);
      this.publishState();
    }
  }

  /** Called on every room state update: create/close peer connections and update routing. */
  sync(room: RoomState | null) {
    this.room = room;
    if (!this.enabled) return;
    const myId = this.myId();
    if (!room || !myId || room.isPublic) { this.disable(!!room); return; }
    const wanted = new Set(room.players.filter((p) => p.id !== myId && p.voice?.on && p.connected).map((p) => p.id));
    for (const id of [...this.peers.keys()]) if (!wanted.has(id)) this.closePeer(id);
    // the player with the smaller id makes the offer (avoids both sides offering at once)
    for (const id of wanted) if (!this.peers.has(id) && myId < id) void this.connectTo(id);
    this.route();
  }

  private createPeer(id: string, offerer: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: iceServers ?? [] });
    const peer: Peer = { id, pc, offerer, transceiver: null, audio: null, analyser: null, createdAt: Date.now(), attempts: 0 };
    pc.onicecandidate = (e) => { if (e.candidate) this.emit('voice:signal', { to: id, data: { candidate: e.candidate.toJSON() } }); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      const el = peer.audio ?? new Audio();
      el.autoplay = true;
      (el as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
      el.srcObject = stream;
      el.muted = useStore.getState().voice.muted.includes(id);
      el.volume = this.volume();
      if (!peer.audio) { el.style.display = 'none'; document.body.appendChild(el); }
      peer.audio = el;
      el.play().catch(() => {});
      const ctx = audioContext();
      if (ctx) {
        try {
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(an);
          peer.analyser = an;
        } catch { /* indicator only */ }
      }
    };
    pc.onconnectionstatechange = () => {
      const s = useStore.getState().voice;
      setVoice({ status: { ...s.status, [id]: pc.connectionState } });
    };
    this.peers.set(id, peer);
    return peer;
  }

  private async connectTo(id: string, attempts = 0) {
    await getIceServers();
    const peer = this.createPeer(id, true);
    peer.attempts = attempts;
    peer.transceiver = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.route();
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.emit('voice:signal', { to: id, data: { sdp: peer.pc.localDescription?.toJSON() } });
    } catch (e) {
      console.warn('[voice] offer failed', e);
    }
  }

  async handleSignal(from: string, data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
    if (!this.enabled) return;
    try {
      if (data.sdp?.type === 'offer') {
        await getIceServers();
        if (this.peers.has(from)) this.closePeer(from);
        const peer = this.createPeer(from, false);
        await peer.pc.setRemoteDescription(data.sdp);
        peer.transceiver = peer.pc.getTransceivers()[0] ?? null;
        if (peer.transceiver) peer.transceiver.direction = 'sendrecv';
        await this.flushIce(peer);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        this.emit('voice:signal', { to: from, data: { sdp: peer.pc.localDescription?.toJSON() } });
        this.route();
      } else if (data.sdp?.type === 'answer') {
        const peer = this.peers.get(from);
        if (peer && peer.pc.signalingState === 'have-local-offer') {
          await peer.pc.setRemoteDescription(data.sdp);
          await this.flushIce(peer);
        }
      } else if (data.candidate) {
        const peer = this.peers.get(from);
        if (peer?.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
        else this.pendingIce.set(from, [...(this.pendingIce.get(from) ?? []), data.candidate]);
      }
    } catch (e) {
      console.warn('[voice] signal error', e);
    }
  }

  private async flushIce(peer: Peer) {
    const list = this.pendingIce.get(peer.id) ?? [];
    this.pendingIce.delete(peer.id);
    for (const c of list) await peer.pc.addIceCandidate(c).catch(() => {});
  }

  private closePeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    this.pendingIce.delete(id);
    try { p.pc.close(); } catch { /* ignore */ }
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
    const s = useStore.getState().voice;
    const status = { ...s.status };
    delete status[id];
    setVoice({ status });
  }

  /** Attach my mic only to the senders of players who should hear me. */
  private route() {
    const s = useStore.getState();
    const audience = new Set(computeAudience(this.room ?? s.room, s.myId, s.voice));
    const track = this.micStream?.getAudioTracks()[0] ?? null;
    for (const [id, p] of this.peers) {
      const want = track && audience.has(id) ? track : null;
      const sender = p.transceiver?.sender;
      if (sender && sender.track !== want) sender.replaceTrack(want).catch(() => {});
    }
    const hearsMe = [...audience].filter((id) => this.peers.has(id));
    if (hearsMe.join() !== s.voice.hearsMe.join()) setVoice({ hearsMe });
  }

  private volume() {
    const st = useStore.getState().settings;
    return Math.max(0, Math.min(1, st.master * (st.voice ?? 1)));
  }

  private level(an: AnalyserNode | null) {
    if (!an) return 0;
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / buf.length);
  }

  private tick() {
    const s = useStore.getState();
    const speaking: Record<string, boolean> = {};
    for (const [id, p] of this.peers) {
      if (p.audio) p.audio.volume = this.volume();
      speaking[id] = !s.voice.muted.includes(id) && this.level(p.analyser) > 0.03;
      // retry connections that never came up (lost offer, network change)
      const st = p.pc.connectionState;
      if (p.offerer && st !== 'connected' && st !== 'connecting' && Date.now() - p.createdAt > 12_000 && p.attempts < 3) {
        this.closePeer(id);
        void this.connectTo(id, p.attempts + 1);
      }
    }
    if (s.myId) speaking[s.myId] = s.voice.mic && s.voice.hearsMe.length > 0 && this.level(this.micAnalyser) > 0.03;
    const prev = s.voice.speaking;
    const changed = Object.keys({ ...prev, ...speaking }).some((k) => !!prev[k] !== !!speaking[k]);
    if (changed) setVoice({ speaking });
    this.route();
  }

  /** Debug/test helper: bytes received from a peer. */
  async bytesFrom(id: string): Promise<number> {
    const p = this.peers.get(id);
    if (!p) return -1;
    let bytes = 0;
    (await p.pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived ?? 0; });
    return bytes;
  }
}

export const voice = new VoiceManager();
if (typeof window !== 'undefined') (window as unknown as { __hueVoice: VoiceManager }).__hueVoice = voice;
