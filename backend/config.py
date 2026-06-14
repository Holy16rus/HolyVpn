import os
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES_FILE = ROOT / "sources.json"
OUTPUT_FILE = ROOT / "HolyVPN.yaml"
WEB_DIR = ROOT / "web"

PROXYCHECK_KEY = "3m01d6-0h1849-93710l-xo271j"
GLOBALPING_KEY = "yzjphexhdtnzlb2syywsqhqhbnfgianu"

CHECK_BATCH_SIZE = 1000
GLOBALPING_BATCH = 50
TIMEOUT = 15

COUNTRY_NAMES_RU = {
    "AE": "ОАЭ", "AR": "Аргентина", "AT": "Австрия", "AU": "Австралия",
    "BE": "Бельгия", "BG": "Болгария", "BR": "Бразилия", "CA": "Канада",
    "CH": "Швейцария", "CL": "Чили", "CN": "Китай", "CO": "Колумбия",
    "CZ": "Чехия", "DE": "Германия", "DK": "Дания", "EE": "Эстония",
    "EG": "Египет", "ES": "Испания", "FI": "Финляндия", "FR": "Франция",
    "GB": "Великобритания", "GR": "Греция", "HK": "Гонконг", "HU": "Венгрия",
    "ID": "Индонезия", "IE": "Ирландия", "IL": "Израиль", "IN": "Индия",
    "IT": "Италия", "JP": "Япония", "KR": "Южная Корея", "LT": "Литва",
    "LV": "Латвия", "MX": "Мексика", "MY": "Малайзия", "NL": "Нидерланды",
    "NO": "Норвегия", "NZ": "Новая Зеландия", "PH": "Филиппины", "PL": "Польша",
    "PT": "Португалия", "RO": "Румыния", "RU": "Россия", "SE": "Швеция",
    "SG": "Сингапур", "SK": "Словакия", "TH": "Таиланд", "TR": "Турция",
    "TW": "Тайвань", "UA": "Украина", "US": "США", "VN": "Вьетнам",
    "ZA": "ЮАР", "ZZ": "Неизвестно",
}


def load_sources():
    if not SOURCES_FILE.exists():
        return {"sources": [], "local_files": ["proxy.txt"]}
    try:
        data = json.loads(SOURCES_FILE.read_text("utf-8"))
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            return {"sources": data, "local_files": ["proxy.txt"]}
    except Exception:
        pass
    return {"sources": [], "local_files": ["proxy.txt"]}


def save_sources(data):
    SOURCES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
