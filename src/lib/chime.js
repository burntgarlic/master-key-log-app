let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  return audioCtx
}

// Call from a user gesture (e.g. the Start tap) so the context is unlocked
// before the finish chime needs to play on its own, without a fresh gesture.
export function primeChime() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    // Web Audio unavailable — finish will just be silent + vibration.
  }
}

// A soft two-note chime (no harsh alarm) for countdown completion.
export function playChime() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime
    ;[
      { at: 0, freq: 660 },
      { at: 0.3, freq: 880 },
    ].forEach(({ at, freq }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + at)
      gain.gain.linearRampToValueAtTime(0.15, now + at + 0.05)
      gain.gain.linearRampToValueAtTime(0, now + at + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.6)
    })
  } catch {
    // Silent failure — vibration still fires separately.
  }
}
