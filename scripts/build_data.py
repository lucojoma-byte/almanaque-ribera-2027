"""Publica las tres hojas autorizadas del libro y actualiza la caché offline."""
import argparse
import hashlib
import json
import os
from datetime import date, datetime, time
from pathlib import Path
from tempfile import NamedTemporaryFile

from openpyxl import load_workbook
from openpyxl.utils.cell import range_boundaries

ROOT = Path(__file__).resolve().parents[1]
SHEETS = {
    "CIELO": ("cielo", ["CieloDiario"]),
    "SIEMBRA": ("siembra", ["Cultivos"]),
    "FECHAS Y CLIMA": ("fechas-clima", ["FechasDiarias", "NormalesSMN"]),
}


def value(cell, cached):
    v = cell.value
    if cell.data_type == "f":
        v = cached[cell.coordinate].value
        if v is None:
            raise ValueError(f"{cell.parent.title}!{cell.coordinate}: guarda la fórmula recalculada en Excel.")
    if isinstance(v, datetime) and v.time() == time.min:
        return v.date().isoformat()
    if isinstance(v, (date, time)):
        return v.isoformat()
    if cell.data_type == "e":
        raise ValueError(f"Error de Excel en {cell.parent.title}!{cell.coordinate}: {v}")
    return v


def records(sheet, cached, header_row, last_row, columns):
    headers = [sheet.cell(header_row, col).value for col in columns]
    if any(not isinstance(h, str) or not h.strip() for h in headers) or len(set(headers)) != len(headers):
        raise ValueError(f"Encabezados vacíos o repetidos en {sheet.title}, fila {header_row}.")
    result = []
    for row in range(header_row + 1, last_row + 1):
        values = [value(sheet.cell(row, col), cached) for col in columns]
        if any(v is not None for v in values):
            result.append(dict(zip(headers, values)))
    return result


def extract(sheet, cached, names):
    tables, used = {}, set()
    for name in names:
        left, top, right, bottom = range_boundaries(sheet.tables[name].ref)
        tables[name] = records(sheet, cached, top, bottom, range(left, right + 1))
        used.update(range(top, bottom + 1))
    if sheet.title == "SIEMBRA":
        header = next((r for r in sheet.rows if any(c.value == "Siembra, trasplante o cosecha" for c in r)), None)
        if header is None:
            raise ValueError("Falta el encabezado de labores mensuales en SIEMBRA.")
        top = bottom = header[0].row
        while bottom < sheet.max_row and sheet.cell(bottom + 1, 1).value is not None:
            bottom += 1
        tables["HuertoMensual"] = records(sheet, cached, top, bottom, [c.column for c in header if c.value])
        used.update(range(top, bottom + 1))
    # Conserva las notas, fuentes y aclaraciones en sus coordenadas originales.
    notes = [{c.coordinate: value(c, cached) for c in row if c.value is not None}
             for row in sheet.rows if row[0].row not in used and any(c.value is not None for c in row)]
    return {"hoja": sheet.title, "tablas": tables, "notas": notes}


def replace_file(path, content):
    with NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        temp.write(content)
    os.replace(temp.name, path)


def build(source):
    public = ROOT / "public"
    book = load_workbook(source)
    cached = load_workbook(source, data_only=True)
    outputs = {}
    try:
        for title, (slug, names) in SHEETS.items():
            data = extract(book[title], cached[title], names)
            outputs[f"data/{slug}.json"] = (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    finally:
        book.close()
        cached.close()
    names = (ROOT / "scripts/public-files.txt").read_text(encoding="utf-8").splitlines()
    assets = {name: outputs[name] if name in outputs else (public / name).read_bytes()
              for name in names if name and name != "sw.js"}
    template = (ROOT / "scripts/sw.template.js").read_bytes()
    digest = hashlib.sha256(template)
    for name, content in sorted(assets.items()):
        digest.update(name.encode() + b"\0" + hashlib.sha256(content).digest())
    version = digest.hexdigest()[:20]
    worker = template.decode().replace("__BUILD__", version).replace("__ASSETS__", json.dumps(sorted(assets)))
    (public / "data").mkdir(exist_ok=True)
    # Retira la salida generada por versiones anteriores del conversor.
    (public / "data/negocio-vida.json").unlink(missing_ok=True)
    for name, content in outputs.items():
        replace_file(public / name, content)
    replace_file(public / "sw.js", worker.encode())
    print(f"{len(SHEETS)} hojas públicas convertidas. Versión offline {version}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("excel", nargs="?", type=Path, default=ROOT / "data/Almanaque_Ribera_2027_BASE.xlsx")
    try:
        build(parser.parse_args().excel)
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f"No se pudo generar el almanaque: {exc}\n")
