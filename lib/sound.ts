// ============================================================
// SOUND — short audible cue when a rest period ends.
// expo-audio is lazily imported (defensive, like notifications).
// ============================================================

// Static require so Metro bundles the asset.
const REST_END_ASSET = require('../assets/sounds/rest-end.wav');

let player: any = null;
let audioModeSet = false;

async function getAudio(): Promise<any | null> {
  try {
    return await import('expo-audio');
  } catch {
    return null;
  }
}

/** Play the rest-end beep (also audible in iOS silent mode). */
export async function playRestEndSound(): Promise<void> {
  try {
    const A = await getAudio();
    if (!A) return;

    if (!audioModeSet) {
      audioModeSet = true;
      try {
        await A.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      } catch {
        /* ignore */
      }
    }

    if (!player) {
      player = A.createAudioPlayer(REST_END_ASSET);
    }
    try {
      await player.seekTo(0);
    } catch {
      /* ignore — first play has nothing to rewind */
    }
    player.volume = 1.0;
    player.play();
  } catch {
    /* ignore — sound is best-effort */
  }
}
