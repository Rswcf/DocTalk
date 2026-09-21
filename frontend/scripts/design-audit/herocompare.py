"""Compare herocheck.mjs renders: does anything dim the citation, and does the answer fit?

usage: python3 herocompare.py <herocheck-out-dir>

For every <key> in geometry.json it compares <key>.png with <key>-off.png (the control render
without the claim pool and without the field's fade mask) over the passage rows, and reports
whether the answer card ends inside the viewport. Uses macOS `sips` to turn PNG into BMP,
because PIL is not installed.
"""
import json
import os
import struct
import subprocess
import sys


def load(png):
    bmp = png[:-4] + '.bmp'
    subprocess.run(['sips', '-s', 'format', 'bmp', png, '--out', bmp], capture_output=True, check=True)
    b = open(bmp, 'rb').read()
    off = struct.unpack_from('<I', b, 10)[0]
    w, h = struct.unpack_from('<ii', b, 18)
    bpp = struct.unpack_from('<H', b, 28)[0]
    row = ((w * bpp // 8) + 3) // 4 * 4

    def px(x, y):
        yy = (h - 1 - y) if h > 0 else y
        i = off + yy * row + x * (bpp // 8)
        return (b[i + 2], b[i + 1], b[i])

    return px, w, abs(h)


def main(d):
    geometry = json.load(open(os.path.join(d, 'geometry.json')))
    worst = 0
    overflow = []
    for key, g in geometry.items():
        on, w, h = load(os.path.join(d, key + '.png'))
        off, _, _ = load(os.path.join(d, key + '-off.png'))
        # the passage: ~3 lines under passageTop, inside the document column
        x0, x1 = max(0, (w - 1080) // 2 + 60), min(w, (w + 1080) // 2 - 60)
        diffs = []
        for y in range(g['passageTop'] + 4, min(h, g['passageTop'] + 92), 2):
            for x in range(x0, x1, 3):
                a, b = on(x, y), off(x, y)
                diffs.append(max(abs(a[i] - b[i]) for i in range(3)))
        diffs.sort()
        p99 = diffs[int(len(diffs) * 0.99)] if diffs else -1
        worst = max(worst, p99)
        over = g['cardBottom'] - g['vh']
        if over > 0:
            overflow.append((key, over))
        print(f"{key:18s} card {g['cardTop']:4d}-{g['cardBottom']:4d}/{g['vh']:4d} {'fits' if over <= 0 else f'OVER +{over}':9s}"
              f" passage dimming p99={p99:3d} max={diffs[-1] if diffs else -1:3d}")
    print(f"\nworst passage p99 difference: {worst} (0 = nothing dims the citation)")
    print('card overflow:', overflow or 'none')


if __name__ == '__main__':
    main(sys.argv[1])
