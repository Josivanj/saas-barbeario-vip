"""Divide uma grade 6x3 em imagens individuais otimizadas para a galeria."""

from pathlib import Path
import sys

from PIL import Image


SLUGS = [
    "degrade-alto", "degrade-medio", "degrade-baixo", "texturizado",
    "moicano", "risco-na-navalha", "platinado", "social", "crespo",
    "degrade-em-v", "risco-lateral", "militar", "ondulado", "topete",
    "espinhado", "caesar", "franja", "zero-com-risco",
]


def main(source: str, destination: str) -> None:
    image = Image.open(source).convert("RGB")
    output = Path(destination)
    output.mkdir(parents=True, exist_ok=True)

    for index, slug in enumerate(SLUGS):
        column, row = index % 6, index // 6
        left = round(column * image.width / 6)
        right = round((column + 1) * image.width / 6)
        top = round(row * image.height / 3)
        bottom = round((row + 1) * image.height / 3)
        tile = image.crop((left, top, right, bottom)).resize((600, 600), Image.Resampling.LANCZOS)
        tile.save(output / f"{slug}.webp", "WEBP", quality=86, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: split-gallery-sheet.py ORIGEM DESTINO")
    main(sys.argv[1], sys.argv[2])
