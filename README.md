# HolyVPN

Генератор быстрых прокси-подписок для Clash-клиентов.  
Собирает прокси из открытых источников, проверяет, определяет страну и пинг, сортирует — выдаёт готовый YAML.

## Подписка

```
https://raw.githubusercontent.com/Holy16rus/HolyVpn/gh-pages/config.yaml
```

Вставь ссылку во FLClash / Clash как subscription URL.  
Конфиг обновляется автоматически каждые 6 часов.

## Как работает

1. Сбор прокси из GitHub-репозиториев и публичных API
2. Дедупликация и парсинг всех форматов (HTTP, SOCKS5, SS, VMess, VLESS, Trojan, Hysteria2)
3. Проверка доступности (TCP/HTTP/SOCKS5 handshake)
4. Определение страны через ip-api.com, риск через proxycheck.io
5. Замер пинга через Globalping
6. Генерация Clash YAML с группировкой по странам

## Локальный запуск

```bash
git clone https://github.com/Holy16rus/HolyVpn.git
cd HolyVpn
pip install httpx fastapi uvicorn
python start.py
```

Открой `http://127.0.0.1:1488`.

## GitHub Actions

Репозиторий сам перегенерирует подписку каждые 6 часов.  
Можно запустить вручную: Actions → Generate Proxy Config → Run workflow.

---

HolyVPN v2 — red. cyber. fast.
