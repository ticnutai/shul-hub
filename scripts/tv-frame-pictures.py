"""
Cuts the ready-made frame pictures out of the painted boards.

    python scripts/tv-frame-pictures.py

The painted boards (src/tv/assets/illustrated) were one picture each, wall
and frames together. Their frames are worth keeping on their own: a picture
of a frame is laid on any panel with CSS border-image, which keeps the four
corners whole and stretches the edges between them - so the corners have to
be the ornaments, and the edges plain enough to stretch.

Each frame picture here is assembled, not simply cropped: the four corners
are taken as they are, the straight edges between them are squeezed into
place, and the middle is the painting's own parchment. That makes a square
picture whose corners are all the same size, so one slice number (the
`slice` below, in percent) fits all four.

Re-run after changing a recipe, then commit the pictures.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAINTINGS = ROOT / "src" / "tv" / "assets" / "illustrated"
OUT = ROOT / "src" / "tv" / "assets" / "frames"

# name -> (painting, the frame's box (x0, y0, x1, y1), corner size, a box of plain parchment, output size)
RECIPES = {
    # The large gold frame of the curtain board, its corners carved scrolls.
    "gold-ornate": ("curtain.jpg", (28, 314, 923, 950), 190, (300, 560, 650, 720), 600),
    # The carved walnut border around the whole wood board, gold rosettes at its corners.
    "carved-wood": ("wood.jpg", (0, 0, 1920, 1088), 97, (400, 110, 1500, 225), 400),
}


def assemble(painting: str, box, corner: int, plain, size: int) -> Image.Image:
    im = Image.open(PAINTINGS / painting).convert("RGB")
    x0, y0, x1, y1 = box
    c = corner
    mid = size - 2 * c
    out = Image.new("RGB", (size, size))
    # The middle first, so the edges and corners lie over it.
    out.paste(im.crop(plain).resize((mid, mid), Image.LANCZOS), (c, c))
    # Corners, whole.
    out.paste(im.crop((x0, y0, x0 + c, y0 + c)), (0, 0))
    out.paste(im.crop((x1 - c, y0, x1, y0 + c)), (size - c, 0))
    out.paste(im.crop((x0, y1 - c, x0 + c, y1)), (0, size - c))
    out.paste(im.crop((x1 - c, y1 - c, x1, y1)), (size - c, size - c))
    # Edges, squeezed along their length only.
    out.paste(im.crop((x0 + c, y0, x1 - c, y0 + c)).resize((mid, c), Image.LANCZOS), (c, 0))
    out.paste(im.crop((x0 + c, y1 - c, x1 - c, y1)).resize((mid, c), Image.LANCZOS), (c, size - c))
    out.paste(im.crop((x0, y0 + c, x0 + c, y1 - c)).resize((c, mid), Image.LANCZOS), (0, c))
    out.paste(im.crop((x1 - c, y0 + c, x1, y1 - c)).resize((c, mid), Image.LANCZOS), (size - c, c))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (painting, box, corner, plain, size) in RECIPES.items():
        pic = assemble(painting, box, corner, plain, size)
        path = OUT / f"{name}.jpg"
        pic.save(path, quality=86, optimize=True)
        print(f"{name:14} {size}x{size}  slice {round(corner / size * 100)}%  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
