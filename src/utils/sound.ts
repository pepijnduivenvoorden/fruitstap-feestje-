export const SOUNDS = {
  spin: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  lose: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  step: 'https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  fart: 'https://www.soundjay.com/human/fart-01.mp3'
};

export function playSound(url: string) {
  const audio = new Audio(url);
  audio.play().catch(e => console.warn('Audio playback failed:', e));
}
