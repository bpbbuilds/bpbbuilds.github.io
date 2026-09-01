"""Make item-border parchment taller: insert clean parchment+frame between halves."""
from PIL import Image
from pathlib import Path

src = Path(
    r"C:\Users\Justin\.cursor\projects\d-SMOJO-Online-Buisness-BPBWebsite"
    r"\assets\c__Users_Justin_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"fcafc5aecf3daf29cd692b4a8d718545_images_image-53769c9e-c6af-4e23-a0a0-034f157d2ef4.png"
)
out = Path(r"d:\SMOJO\Online\Buisness\BPBWebsite\assets\theme\backgrounds\bg-parchment-item-border-tall.png")

im = Image.open(src).convert("RGB")
w, h = im.size
print("source", w, h)

# Quiet zone before lower side ornaments (gloves / pouch ~y 280+).
seam = 248
frame = 5

# Large clean parchment patch from the open center (inset past icon rings)
pad_x = int(w * 0.16)
pad_y = int(h * 0.30)
parchment = im.crop((pad_x, pad_y, w - pad_x, h - pad_y))

# Thin frame samples from a quiet mid band (dark border only)
frame_y0, frame_y1 = 170, 178
left_frame = im.crop((0, frame_y0, frame, frame_y1))
right_frame = im.crop((w - frame, frame_y0, w, frame_y1))

extra = int(h * 0.50)  # ~1.5× taller
print("seam", seam, "extra", extra, "parchment sample", parchment.size)

top = im.crop((0, 0, w, seam))
bot = im.crop((0, seam, w, h))

# Build insert: stretched parchment + frame edges
insert = Image.new("RGB", (w, extra))
# Mild vertical stretch of a big mottled patch looks natural; avoid tiling stripes
center = parchment.resize((w - 2 * frame, extra), Image.Resampling.LANCZOS)
insert.paste(center, (frame, 0))
insert.paste(left_frame.resize((frame, extra), Image.Resampling.LANCZOS), (0, 0))
insert.paste(right_frame.resize((frame, extra), Image.Resampling.LANCZOS), (w - frame, 0))

# Soft blend insert into top/bottom
blend = 6
canvas = Image.new("RGB", (w, h + extra))
canvas.paste(top, (0, 0))
canvas.paste(insert, (0, seam))
canvas.paste(bot, (0, seam + extra))

top_px = top.load()
ins_px = insert.load()
bot_px = bot.load()
out_px = canvas.load()
for i in range(blend):
    t = (i + 1) / (blend + 1)
    y_top = seam - blend + i
    if 0 <= y_top < seam:
        for x in range(w):
            a = top_px[x, y_top]
            b = ins_px[x, i]
            out_px[x, y_top] = tuple(int(a[c] * (1 - t) + b[c] * t) for c in range(3))
    y_bot_canvas = seam + extra + i
    y_ins2 = extra - blend + i
    if i < bot.height and y_ins2 >= 0:
        for x in range(w):
            a = ins_px[x, y_ins2]
            b = bot_px[x, i]
            out_px[x, y_bot_canvas] = tuple(int(a[c] * (1 - t) + b[c] * t) for c in range(3))

canvas.save(out, optimize=True)
print("wrote", out.name, canvas.size, "aspect", round(w / canvas.size[1], 3))
