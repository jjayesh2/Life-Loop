// Web Audio & Speech Synthesis Service for Life-Loop

class SoundService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;
  private isMuted: boolean = false;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private listeners: Array<() => void> = [];

  constructor() {
    // Restore preferences
    const storedSound = localStorage.getItem('lifeloop_sound_enabled');
    const storedVoice = localStorage.getItem('lifeloop_voice_enabled');
    const storedMute = localStorage.getItem('lifeloop_muted');

    if (storedSound !== null) this.soundEnabled = storedSound === 'true';
    if (storedVoice !== null) this.voiceEnabled = storedVoice === 'true';
    if (storedMute !== null) this.isMuted = storedMute === 'true';
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public getSettings() {
    return {
      soundEnabled: this.soundEnabled,
      voiceEnabled: this.voiceEnabled,
      isMuted: this.isMuted
    };
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('lifeloop_muted', String(this.isMuted));
    this.notify();
    return this.isMuted;
  }

  public toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('lifeloop_sound_enabled', String(this.soundEnabled));
    this.notify();
    return this.soundEnabled;
  }

  public toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    localStorage.setItem('lifeloop_voice_enabled', String(this.voiceEnabled));
    this.notify();
    return this.voiceEnabled;
  }

  // Play pleasant success chime (for approvals, dispatches, deliveries)
  public playSuccessChime() {
    if (this.isMuted || !this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  // Play urgent emergency alert siren (for emergency requests & cold-chain spikes)
  public playEmergencyAlarm() {
    if (this.isMuted || !this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.linearRampToValueAtTime(440, now + 0.2);
      osc.frequency.linearRampToValueAtTime(880, now + 0.4);
      osc.frequency.linearRampToValueAtTime(440, now + 0.6);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  // Play a soft notification ping
  public playNoticePing() {
    this.playPing();
  }

  public playPing() {
    if (this.isMuted || !this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  // Browser Web Speech Synthesis
  public speak(message: string, priority: 'normal' | 'urgent' = 'normal') {
    if (this.isMuted || !this.voiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Duplicate check: avoid repeating same announcement within 6 seconds
    const now = Date.now();
    if (message === this.lastSpokenText && now - this.lastSpokenTime < 6000) {
      return;
    }
    this.lastSpokenText = message;
    this.lastSpokenTime = now;

    try {
      if (priority === 'urgent') {
        window.speechSynthesis.cancel(); // Interrupt ongoing speech for urgent alerts
      }

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;

      // Prefer Indian English voice if available, else default English
      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(v => v.lang.includes('en-IN') || v.name.includes('India'));
      if (inVoice) {
        utterance.voice = inVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }
}

export const soundService = new SoundService();
