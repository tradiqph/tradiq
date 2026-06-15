const SOUND_PATH = "/assets/notif-sound/goldcoin-notif.wav";
const STORAGE_KEY = "tradiq_notification_sound_enabled";

let audio: HTMLAudioElement | null = null;
let preloaded = false;

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "true";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function preloadNotificationSound(): void {
  if (typeof window === "undefined" || preloaded) return;
  audio = new Audio(SOUND_PATH);
  audio.preload = "auto";
  preloaded = true;
}

export function playNotificationSound(): void {
  if (typeof window === "undefined" || !isNotificationSoundEnabled()) return;

  if (!audio) {
    audio = new Audio(SOUND_PATH);
  }

  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Autoplay may be blocked until user interaction.
  });
}
