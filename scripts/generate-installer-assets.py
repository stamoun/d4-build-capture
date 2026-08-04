from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "d4bc-source.png"
ICON = ASSETS / "d4bc.ico"
LOADING_GIF = ASSETS / "installer-loading.gif"


def resampling_filter() -> Image.Resampling:
    return Image.Resampling.LANCZOS


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    family = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype(family, size)
    except OSError:
        return ImageFont.load_default()


def create_icon(source: Image.Image) -> None:
    square = source.convert("RGBA").resize((256, 256), resampling_filter())
    square.save(
        ICON,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def create_loading_gif(source: Image.Image) -> None:
    width, height = 420, 180
    background = (10, 12, 15)
    muted = (177, 181, 187)
    accent = (219, 48, 42)
    track = (48, 51, 57)
    logo = source.convert("RGB").resize((132, 132), resampling_filter())
    title_font = load_font(22, bold=True)
    status_font = load_font(15)
    frames: list[Image.Image] = []

    for frame_index in range(24):
        frame = Image.new("RGB", (width, height), background)
        frame.paste(logo, (20, 24))
        draw = ImageDraw.Draw(frame)
        draw.text((174, 43), "Diablo Build Capture", font=title_font, fill=(244, 244, 245))
        dots = "." * ((frame_index // 6) % 4)
        draw.text((174, 80), f"Installing{dots}", font=status_font, fill=muted)
        draw.rounded_rectangle((174, 116, 392, 124), radius=4, fill=track)

        segment_width = 58
        travel = 218 + segment_width
        segment_start = 174 + ((frame_index * 14) % travel) - segment_width
        segment_end = min(segment_start + segment_width, 392)
        clipped_start = max(segment_start, 174)
        if segment_end > clipped_start:
            draw.rounded_rectangle(
                (clipped_start, 116, segment_end, 124), radius=4, fill=accent
            )

        frames.append(frame)

    frames[0].save(
        LOADING_GIF,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        optimize=True,
    )


def main() -> None:
    source = Image.open(SOURCE)
    create_icon(source)
    create_loading_gif(source)


if __name__ == "__main__":
    main()
