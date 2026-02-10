#!/usr/bin/env python3
"""Generate a 128x128 PNG icon for the VS Code Agent extension."""
import struct, zlib, os

width, height = 128, 128

def make_pixel(x, y):
    cx, cy = 64, 64
    dx, dy = x - cx, y - cy
    dist = (dx*dx + dy*dy) ** 0.5

    # Main circle (robot head)
    if dist <= 48:
        # Eyes
        if 43 <= y <= 55:
            ldx, ldy = x - 48, y - 48
            if (ldx*ldx + ldy*ldy) <= 64:
                return (255, 255, 255, 255)
            rdx, rdy = x - 80, y - 48
            if (rdx*rdx + rdy*rdy) <= 64:
                return (255, 255, 255, 255)
        # Mouth
        if 68 <= y <= 72 and 48 <= x <= 80:
            return (255, 255, 255, 255)
        # Antenna stem
        if 14 <= y <= 18 and 62 <= x <= 66:
            return (100, 149, 237, 255)
        # Antenna ball
        if y < 18 and 58 <= x <= 70:
            dx2, dy2 = x - 64, y - 10
            if (dx2*dx2 + dy2*dy2) <= 36:
                return (100, 149, 237, 255)
        # Head fill
        return (65, 105, 225, 255)
    return (0, 0, 0, 0)

raw = b''
for y in range(height):
    raw += b'\x00'
    for x in range(width):
        r, g, b, a = make_pixel(x, y)
        raw += struct.pack('BBBB', r, g, b, a)

def chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

sig = b'\x89PNG\r\n\x1a\n'
ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
idat = zlib.compress(raw, 9)
png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

outpath = os.path.join(os.path.dirname(__file__), '..', 'media', 'icon.png')
os.makedirs(os.path.dirname(outpath), exist_ok=True)
with open(outpath, 'wb') as f:
    f.write(png)
print(f'Created icon.png: {len(png)} bytes')
