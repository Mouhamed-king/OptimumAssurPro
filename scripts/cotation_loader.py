"""Chargement des grilles tarifaires depuis Cotation Auto.xls."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

import xlrd


@dataclass(frozen=True)
class CvBand:
    label: str
    min_cv: int
    max_cv: int | None


@dataclass
class TariffGrid:
    """Grille avec colonnes essence/diesel distinctes et RC partagé."""

    essence_bands: list[tuple[CvBand, float]]
    diesel_bands: list[tuple[CvBand, float]]


@dataclass
class TwoWheelType:
    label: str
    rc_annual: float


def _cell(ws, row: int, col: int):
    if row < ws.nrows and col < ws.ncols:
        return ws.cell_value(row, col)
    return ""


def _parse_cv_band(label: str) -> CvBand | None:
    text = str(label).strip()
    if not text:
        return None

    match = re.search(r"(\d+)\s*à\s*(\d+)", text, re.IGNORECASE)
    if match:
        return CvBand(text, int(match.group(1)), int(match.group(2)))

    match = re.search(r"(\d+)\s*et\s*plus", text, re.IGNORECASE)
    if match:
        return CvBand(text, int(match.group(1)), None)

    return None


def _parse_grid(ws, start_row: int, essence_col: int, diesel_col: int, rc_col: int, max_rows: int = 12) -> TariffGrid:
    essence_bands: list[tuple[CvBand, float]] = []
    diesel_bands: list[tuple[CvBand, float]] = []

    for offset in range(max_rows):
        row = start_row + offset
        essence_label = _cell(ws, row, essence_col)
        diesel_label = _cell(ws, row, diesel_col)
        rc_value = _cell(ws, row, rc_col)

        if not rc_value and not essence_label and not diesel_label:
            continue

        try:
            rc = float(rc_value)
        except (TypeError, ValueError):
            continue

        essence_band = _parse_cv_band(str(essence_label))
        if essence_band:
            essence_bands.append((essence_band, rc))

        diesel_band = _parse_cv_band(str(diesel_label))
        if diesel_band:
            diesel_bands.append((diesel_band, rc))

    return TariffGrid(essence_bands=essence_bands, diesel_bands=diesel_bands)


def _parse_two_wheel(ws, start_row: int, type_col: int, rc_col: int, max_rows: int = 10) -> list[TwoWheelType]:
    types: list[TwoWheelType] = []
    for offset in range(max_rows):
        row = start_row + offset
        label = str(_cell(ws, row, type_col)).strip()
        rc_value = _cell(ws, row, rc_col)
        if not label or label.upper() == "TYPE":
            continue
        try:
            rc = float(rc_value)
        except (TypeError, ValueError):
            continue
        types.append(TwoWheelType(label=label, rc_annual=rc))
    return types


def _parse_duration_primes(ws, start_row: int, count: int = 12) -> dict[int, float]:
    """Prime nette bonus 20% par nombre de mois (colonne H du bloc bonus)."""
    primes: dict[int, float] = {}
    for offset in range(count):
        row = start_row + offset
        label = str(_cell(ws, row, 0)).strip().lower()
        if not label:
            continue

        try:
            prime = float(_cell(ws, row, 7))
        except (TypeError, ValueError):
            continue

        if label == "1 an":
            primes[12] = prime
            continue

        match = re.search(r"(\d+)\s*mois", label)
        if match:
            primes[int(match.group(1))] = prime

    return primes


def _match_cv_band(puissance: int, bands: list[tuple[CvBand, float]]) -> float | None:
    for band, rc in bands:
        if band.max_cv is None:
            if puissance >= band.min_cv:
                return rc
        elif band.min_cv <= puissance <= band.max_cv:
            return rc
    return None


def _normalize_energy(energie: str) -> str:
    text = str(energie or "").strip().upper()
    if "DIESEL" in text or text == "GO":
        return "diesel"
    return "essence"


def _normalize_category(categorie: str) -> str:
    text = str(categorie or "").strip().upper()
    match = re.search(r"(\d+)", text)
    return match.group(1) if match else text


def _normalize_charge_utile(charge: str) -> str:
    text = str(charge or "").strip().lower()
    if "break" in text:
        return "break"
    if "inf" in text or "3t500" in text.replace(" ", "").replace(",", "."):
        if "sup" not in text:
            return "inferieur_3t500"
    if "sup" in text:
        return "superieur_3t500"
    return text


def _parse_duration_months(duree: str) -> int | None:
    text = str(duree or "").strip().lower()
    if not text:
        return None
    if "an" in text and "mois" not in text:
        return 12
    match = re.search(r"(\d+)\s*mois", text)
    return int(match.group(1)) if match else None


def _cyclomoteur_type(types: list[TwoWheelType]) -> TwoWheelType | None:
    return next((t for t in types if "cyclomoteur" in t.label.lower()), None)


@dataclass
class CotationData:
    cat1_tourisme: TariffGrid
    cat2_break: TariffGrid
    cat2_prive_inf_3t5: TariffGrid
    cat2_prive_sup_3t5: TariffGrid
    cat5_two_wheel: list[TwoWheelType]
    bonus_primes_by_months: dict[int, float]
    reference_annual_rc: float

    def rc_for_cat1(self, puissance: int) -> float | None:
        bands = self.cat1_tourisme.essence_bands or self.cat1_tourisme.diesel_bands
        return _match_cv_band(puissance, bands)

    def rc_for_cat2(self, puissance: int, energie: str, charge_utile: str) -> float | None:
        charge = _normalize_charge_utile(charge_utile)
        is_diesel = _normalize_energy(energie) == "diesel"

        if charge == "break":
            grid = self.cat2_break
        elif charge == "superieur_3t500":
            grid = self.cat2_prive_sup_3t5
        elif charge == "inferieur_3t500":
            grid = self.cat2_prive_inf_3t5
        else:
            return None

        bands = grid.diesel_bands if is_diesel else grid.essence_bands
        return _match_cv_band(puissance, bands)

    def rc_for_cat5(self) -> float | None:
        cyclomoteur = _cyclomoteur_type(self.cat5_two_wheel)
        return cyclomoteur.rc_annual if cyclomoteur else None

    def prime_nette_bonus(self, rc_annual: float, duree: str) -> float | None:
        months = _parse_duration_months(duree)
        if months is None:
            return None

        ref_prime = self.bonus_primes_by_months.get(months)
        if ref_prime is None or not self.reference_annual_rc:
            return None

        return math.floor(rc_annual * (ref_prime / self.reference_annual_rc))


def load_cotation(path: str | Path, sheet_name: str = "Tarif auto") -> CotationData:
    workbook = xlrd.open_workbook(str(path))
    worksheet = workbook.sheet_by_name(sheet_name)

    reference_annual_rc = float(_cell(worksheet, 3, 1) or 0)

    return CotationData(
        cat1_tourisme=_parse_grid(worksheet, start_row=4, essence_col=14, diesel_col=15, rc_col=16),
        cat2_break=_parse_grid(worksheet, start_row=4, essence_col=18, diesel_col=19, rc_col=20),
        cat2_prive_inf_3t5=_parse_grid(worksheet, start_row=14, essence_col=14, diesel_col=15, rc_col=16),
        cat2_prive_sup_3t5=_parse_grid(worksheet, start_row=14, essence_col=18, diesel_col=19, rc_col=20),
        cat5_two_wheel=_parse_two_wheel(worksheet, start_row=41, type_col=14, rc_col=16),
        bonus_primes_by_months=_parse_duration_primes(worksheet, start_row=20),
        reference_annual_rc=reference_annual_rc,
    )
