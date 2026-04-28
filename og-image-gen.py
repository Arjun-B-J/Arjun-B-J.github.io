"""Generate og-image.png (1200x630) for arjun-b-j.github.io.
Re-run after editing if any text/style changes:
    python og-image-gen.py
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1200, 630
HERE = Path(__file__).parent

# Base dark canvas (Aurora green-black)
img = Image.new("RGBA", (W, H), (6, 24, 18, 255))


def add_radial(target, cx, cy, radius, rgb, max_alpha=70):
    """Paint a soft radial blob via concentric translucent ellipses."""
    overlay = Image.new("RGBA", target.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(overlay)
    steps = 80
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        a = int(max_alpha * (1 - (i / steps) ** 1.4))
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*rgb, a))
    target.alpha_composite(overlay)


# Aurora orbs — emerald + cyan, mimicking the site's drifting aurora
add_radial(img, 150, 80, 720, (16, 185, 129), 80)
add_radial(img, 1050, 200, 720, (34, 211, 238), 60)
add_radial(img, 600, 550, 520, (16, 185, 129), 35)

img = img.convert("RGB")
draw = ImageDraw.Draw(img)


def load(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# Windows-installed faces (Segoe UI as the closest stand-in for Inter)
name_font = load("C:/Windows/Fonts/segoeuib.ttf", 92)
greet_font = load("C:/Windows/Fonts/consola.ttf", 26)
role_font = load("C:/Windows/Fonts/segoeui.ttf", 36)
tagline_font = load("C:/Windows/Fonts/segoeui.ttf", 28)
url_font = load("C:/Windows/Fonts/consola.ttf", 26)
mark_font = load("C:/Windows/Fonts/segoeuib.ttf", 36)

WHITE = (245, 247, 250)
EMERALD = (16, 185, 129)
CYAN = (34, 211, 238)
SUB = (180, 200, 195)
DIM = (140, 165, 158)


def text_w(s, font):
    bbox = draw.textbbox((0, 0), s, font=font)
    return bbox[2] - bbox[0]


# Top-left mark
draw.text((60, 50), "ABJ", fill=EMERALD, font=mark_font)

# Greeting line — small, mono, dim
draw.text((60, 110), "—  Hello, I'm", fill=DIM, font=greet_font)

# Name (centered) — "Arjun Bindu " in white, "Jayachandran" in cyan
ab = "Arjun Bindu "
last = "Jayachandran"
ab_w = text_w(ab, name_font)
last_w = text_w(last, name_font)
total_w = ab_w + last_w
start_x = (W - total_w) // 2
name_y = 220
draw.text((start_x, name_y), ab, fill=WHITE, font=name_font)
draw.text((start_x + ab_w, name_y), last, fill=EMERALD, font=name_font)

# Role line (centered)
role = "Senior Software Engineer  ·  Wells Fargo  ·  NIT Calicut '22"
draw.text(((W - text_w(role, role_font)) // 2, name_y + 130), role, fill=SUB, font=role_font)

# Tagline (centered)
tag = "GenAI agents  ·  two-tower retrievers  ·  PnL microservices at scale"
draw.text(((W - text_w(tag, tagline_font)) // 2, name_y + 195), tag, fill=DIM, font=tagline_font)

# URL bottom-left
draw.text((60, H - 80), "arjun-b-j.github.io", fill=EMERALD, font=url_font)

# Bottom 4px gradient bar (emerald -> cyan)
for x in range(W):
    t = x / (W - 1)
    r = int(EMERALD[0] + (CYAN[0] - EMERALD[0]) * t)
    g = int(EMERALD[1] + (CYAN[1] - EMERALD[1]) * t)
    b = int(EMERALD[2] + (CYAN[2] - EMERALD[2]) * t)
    draw.line([(x, H - 4), (x, H - 1)], fill=(r, g, b))

out = HERE / "og-image.png"
img.save(out, optimize=True)
print(f"Saved {out} ({W}x{H}, {out.stat().st_size} bytes)")
