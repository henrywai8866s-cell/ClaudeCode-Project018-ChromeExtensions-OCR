"""
Run this script once to generate the extension icons.
  python3 generate_icons.py
Requires only the Python standard library (no pip packages needed).
"""
import struct
import zlib
import os

def make_png(size, bg_rgb, letter="T", letter_rgb=(255, 255, 255)):
    """Generate a solid-color PNG with a centered letter."""
    r, g, b = bg_rgb
    lr, lg, lb = letter_rgb
    width = height = size

    # Build pixel grid
    pixels = []
    cx, cy = size // 2, size // 2
    font_size = max(1, size // 2)

    for y in range(height):
        row = []
        for x in range(width):
            # Rounded rectangle background
            margin = size * 0.12
            rx = size * 0.18  # corner radius
            in_rect = (x >= margin and x < size - margin and
                       y >= margin and y < size - margin)
            if in_rect:
                row.extend([r, g, b])
            else:
                row.extend([240, 244, 248])  # light grey outside
        pixels.append(bytes(row))

    # Draw a simple "T" shape in the center (pixel art style)
    def draw_rect(px, py, pw, ph, color):
        cr, cg, cb = color
        for dy in range(ph):
            ry = py + dy
            if 0 <= ry < height:
                for dx in range(pw):
                    rx_pos = px + dx
                    if 0 <= rx_pos < width:
                        row_bytes = bytearray(pixels[ry])
                        row_bytes[rx_pos * 3]     = cr
                        row_bytes[rx_pos * 3 + 1] = cg
                        row_bytes[rx_pos * 3 + 2] = cb
                        pixels[ry] = bytes(row_bytes)

    # Draw the letter T scaled to icon size
    th = max(1, size // 6)   # thickness
    tw = max(1, size * 2 // 3)  # top bar width
    sh = max(1, size * 2 // 5)  # stem height
    sw = th                      # stem width

    top_bar_x = cx - tw // 2
    top_bar_y = cy - sh // 2
    stem_x = cx - sw // 2
    stem_y = top_bar_y + th

    draw_rect(top_bar_x, top_bar_y, tw, th, letter_rgb)
    draw_rect(stem_x, stem_y, sw, sh, letter_rgb)

    # PNG encode
    raw = b"".join(b"\x00" + row for row in pixels)

    def chunk(name, data):
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


os.makedirs("icons", exist_ok=True)

BLUE = (26, 115, 232)   # #1a73e8

for size in [16, 48, 128]:
    data = make_png(size, BLUE)
    path = f"icons/icon{size}.png"
    with open(path, "wb") as f:
        f.write(data)
    print(f"✓ {path}  ({len(data)} bytes)")

print("\nDone! Load the extension in Chrome: chrome://extensions → Load unpacked")
