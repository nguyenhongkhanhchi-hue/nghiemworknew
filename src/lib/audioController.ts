/**
 * AAA Audio Controller - Professional Sound System
 * Features:
 * - Zero latency using Web Audio API
 * - Master volume control
 * - Mute toggle
 * - Debouncing to prevent spam
 * - Audio ducking for ambient sounds
 * - Fade in/out for smooth transitions
 * - LocalStorage persistence
 */

import { 
  playChime, 
  playAchievementSound, 
  playCompletionSound, 
  playWarningSound,
  playTimerStartSound,
  playTimerPauseSound,
  playTimerStopSound,
  playClickSound,
  playSuccessSound,
  playErrorSound
} from './soundEffects';

// ============ TYPES ============
export type SoundType = 
  | 'click'
  | 'navigation'
  | 'achievement'
  | 'completion'
  | 'warning'
  | 'timerStart'
  | 'timerPause'
  | 'timerStop'
  | 'success'
  | 'error'
  | 'chime'
  | 'overdue'
  | 'delete';

export interface AudioSettings {
  enabled: boolean;
  masterVolume: number; // 0-1
  sfxVolume: number;  // 0-1 for sound effects
}

// ============ STATE ============
let audioSettings: AudioSettings = {
  enabled: true,
  masterVolume: 0.7,
  sfxVolume: 1.0,
};

// Debounce tracking - prevent spam
const lastPlayTime: Record<SoundType, number> = {} as any;
const DEBOUNCE_MS = 300; // 300ms between same sound

// Audio ducking
let masterGainNode: GainNode | null = null;
let ambientGainNode: GainNode | null = null;
const AMBIENT_DUCK_VOLUME = 0.3; // Ambient drops to 30% when notification plays

// ============ INITIALIZATION ============
function initAudioContext(): AudioContext {
  // This ensures AudioContext is created on user interaction
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioContextClass();
}

// Lazy initialization of audio context
let audioCtx: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = initAudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ============ MASTER VOLUME CONTROL ============
export function setMasterVolume(volume: number): void {
  audioSettings.masterVolume = Math.max(0, Math.min(1, volume));
  saveAudioSettings();
}

export function getMasterVolume(): number {
  return audioSettings.masterVolume;
}

export function setAudioEnabled(enabled: boolean): void {
  audioSettings.enabled = enabled;
  saveAudioSettings();
}

export function isAudioEnabled(): boolean {
  return audioSettings.enabled;
}

// ============ AUDIO DUCKING ============
/**
 * Start ambient music with ducking support
 * Call this when playing ambient/background music
 */
export function startAmbientMusic(): void {
  const ctx = getAudioContext();
  if (!ambientGainNode) {
    ambientGainNode = ctx.createGain();
    ambientGainNode.connect(ctx.destination);
    ambientGainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  }
}

export function getAmbientGainNode(): GainNode | null {
  return ambientGainNode;
}

/**
 * Duck ambient volume when notification plays
 * @param duration - How long to duck in seconds
 */
export function duckAmbient(duration: number = 1.5): void {
  if (!ambientGainNode) return;
  
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Smoothly reduce ambient volume
  ambientGainNode.gain.cancelScheduledValues(now);
  ambientGainNode.gain.setValueAtTime(ambientGainNode.gain.value, now);
  ambientGainNode.gain.linearRampToValueAtTime(AMBIENT_DUCK_VOLUME * 0.5, now + 0.1);
  
  // Restore after duration
  ambientGainNode.gain.linearRampToValueAtTime(0.5, now + duration);
}

// ============ DEBOUNCING ============
function canPlaySound(soundType: SoundType): boolean {
  const now = Date.now();
  const lastPlay = lastPlayTime[soundType] || 0;
  
  if (now - lastPlay < DEBOUNCE_MS) {
    return false;
  }
  
  lastPlayTime[soundType] = now;
  return true;
}

// ============ FADE IN/OUT ============
/**
 * Apply fade in/out to prevent "pop" sounds
 * This is now integrated into individual sound functions
 */

// ============ PLAY FUNCTIONS ============
function applyVolume(gainNode: GainNode, baseVolume: number): void {
  const ctx = getAudioContext();
  const volume = audioSettings.enabled 
    ? baseVolume * audioSettings.masterVolume * audioSettings.sfxVolume 
    : 0;
  
  // Fade in to prevent pop
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
}

export function playSound(type: SoundType): void {
  if (!audioSettings.enabled) return;
  if (!canPlaySound(type)) return;
  
  // Duck ambient for important sounds
  if (['achievement', 'completion', 'warning', 'success'].includes(type)) {
    duckAmbient(1.5);
  }
  
  switch (type) {
    case 'click':
    case 'navigation':
      playClickSound();
      break;
    case 'achievement':
      playAchievementSound();
      break;
    case 'completion':
      playCompletionSound();
      break;
    case 'warning':
      playWarningSound();
      break;
    case 'timerStart':
      playTimerStartSound();
      break;
    case 'timerPause':
      playTimerPauseSound();
      break;
    case 'timerStop':
      playTimerStopSound();
      break;
    case 'success':
      playSuccessSound();
      break;
    case 'error':
      playErrorSound();
      break;
    case 'chime':
      playChime();
      break;
    case 'overdue':
      playWarningSound();
      break;
    case 'delete':
      playErrorSound();
      break;
  }
}

// ============ SETTINGS PERSISTENCE ============
const AUDIO_SETTINGS_KEY = 'nw_audio_settings';

function saveAudioSettings(): void {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
  } catch (e) {
    console.warn('Failed to save audio settings:', e);
  }
}

export function loadAudioSettings(): AudioSettings {
  try {
    const saved = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      audioSettings = {
        enabled: parsed.enabled ?? true,
        masterVolume: parsed.masterVolume ?? 0.7,
        sfxVolume: parsed.sfxVolume ?? 1.0,
      };
    }
  } catch (e) {
    console.warn('Failed to load audio settings:', e);
  }
  return audioSettings;
}

export function getAudioSettings(): AudioSettings {
  return { ...audioSettings };
}

// ============ INITIALIZE ============
// Auto-load settings on module import
loadAudioSettings();
