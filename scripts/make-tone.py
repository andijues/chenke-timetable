from pathlib import Path
import math
import struct
import wave
out = Path(__file__).resolve().parent.parent / 'native/harmony/entry/src/main/resources/rawfile/wake.wav'
out.parent.mkdir(parents=True, exist_ok=True)
rate = 22050
with wave.open(str(out), 'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
    samples = []
    for i in range(rate * 6):
        t = i / rate; phase = t % 1.5
        envelope = max(0, 1 - phase / .85) ** 2 if phase < .85 else 0
        envelope *= min(1, phase / .025)
        signal = (math.sin(2 * math.pi * 660 * t) + .4 * math.sin(2 * math.pi * 880 * t)) * envelope * .3
        samples.append(struct.pack('<h', int(max(-1, min(1, signal)) * 32767)))
    f.writeframes(b''.join(samples))
print('已生成原创测试铃声 wake.wav。')
