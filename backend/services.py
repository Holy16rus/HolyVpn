import asyncio
import ipaddress
import json
import httpx

PROXYCHECK_KEY = "3m01d6-0h1849-93710l-xo271j"
GLOBALPING_KEY = "yzjphexhdtnzlb2syywsqhqhbnfgianu"


async def geoip_batch(ips, cancel_event):
    if not ips:
        return {}
    resolved = await resolve_hosts(ips, cancel_event)
    by_ip = {}
    for host in ips:
        ip = resolved.get(host, host)
        if ip:
            by_ip.setdefault(ip, []).append(host)

    result_map = {}
    batch_size = 100
    async with httpx.AsyncClient(timeout=15) as client:
        ip_list = list(by_ip.keys())
        for i in range(0, len(ip_list), batch_size):
            if cancel_event.is_set():
                break
            batch = ip_list[i:i + batch_size]
            try:
                payload = json.dumps(batch).encode("utf-8")
                resp = await client.post(
                    "http://ip-api.com/batch?fields=status,countryCode,lat,lon,query",
                    content=payload,
                    headers={"Content-Type": "application/json"},
                )
                data = resp.json()
                for item in data:
                    if isinstance(item, dict) and item.get("status") == "success":
                        ip = item.get("query", "")
                        cc = (item.get("countryCode") or "ZZ").upper()[:2]
                        if ip and cc != "ZZ":
                            for host in by_ip.get(ip, [ip]):
                                result_map[host] = {
                                    "country": cc,
                                    "ip": ip,
                                    "lat": item.get("lat"),
                                    "lon": item.get("lon"),
                                }
            except Exception:
                continue
    return result_map


def _is_ip(value):
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def _is_public_ip(value):
    try:
        return ipaddress.ip_address(value).is_global
    except ValueError:
        return False


async def resolve_hosts(hosts, cancel_event):
    results = {}
    sem = asyncio.Semaphore(50)
    loop = asyncio.get_running_loop()

    async def resolve(host, client):
        if not host or cancel_event.is_set():
            return
        host = str(host).strip().rstrip(".")
        if _is_ip(host):
            if _is_public_ip(host):
                results[host] = host
            return
        try:
            async with sem:
                resp = await client.get(
                    "https://cloudflare-dns.com/dns-query",
                    params={"name": host, "type": "A"},
                    headers={"Accept": "application/dns-json"},
                )
            data = resp.json()
            for answer in data.get("Answer", []):
                ip = answer.get("data", "")
                if answer.get("type") == 1 and _is_public_ip(ip):
                    results[host] = ip
                    return
        except Exception:
            pass

        try:
            async with sem:
                infos = await asyncio.wait_for(loop.getaddrinfo(host, 0, type=0), timeout=3)
            for family, _, _, _, sockaddr in infos:
                ip = sockaddr[0]
                if ":" not in ip and _is_public_ip(ip):
                    results[host] = ip
                    return
            if infos:
                ip = infos[0][4][0]
                if _is_public_ip(ip):
                    results[host] = ip
        except Exception:
            return

    async with httpx.AsyncClient(timeout=5) as client:
        await asyncio.gather(*(resolve(host, client) for host in hosts))
    return results


async def proxycheck_risk(ips, cancel_event):
    if not ips or not PROXYCHECK_KEY:
        return {}
    result_map = {}
    async with httpx.AsyncClient(timeout=20) as client:
        for i in range(0, len(ips), 500):
            if cancel_event.is_set():
                break
            batch = ips[i:i + 500]
            try:
                resp = await client.get(
                    f"https://proxycheck.io/v2/{','.join(batch)}",
                    params={"key": PROXYCHECK_KEY, "vpn": 1, "asn": 1, "risk": 1},
                )
                data = resp.json()
                for ip, info in data.items():
                    if isinstance(info, dict) and info.get("status") == "ok":
                        existing = result_map.get(ip, {})
                        if info.get("risk") is not None:
                            existing["risk"] = info.get("risk")
                        existing["proxy"] = info.get("proxy")
                        result_map[ip] = existing
            except Exception:
                continue
    return result_map


async def globalping_ping(proxies, cancel_event):
    if not proxies:
        return {}

    results = {}
    limit = 50
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(proxies), limit):
            if cancel_event.is_set():
                break
            batch = proxies[i:i + limit]
            measurements = []

            for proxy in batch:
                host = proxy.get("server", "")
                if not host:
                    continue
                try:
                    resp = await client.post(
                        "https://api.globalping.io/v1/measurements",
                        headers={
                            "Authorization": f"Bearer {GLOBALPING_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={"type": "ping", "target": host, "locations": [{"country": "RU"}]},
                    )
                    if resp.status_code == 202:
                        data = resp.json()
                        measurements.append((proxy, data.get("id")))
                except Exception:
                    continue

            await asyncio.sleep(5)

            for proxy, mid in measurements:
                if cancel_event.is_set():
                    break
                try:
                    resp = await client.get(
                        f"https://api.globalping.io/v1/measurements/{mid}",
                        headers={"Authorization": f"Bearer {GLOBALPING_KEY}"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        results_data = data.get("results", [])
                        if results_data:
                            r = results_data[0].get("result", {})
                            avg = r.get("avg") if isinstance(r, dict) else None
                            if avg is not None:
                                results[proxy["server"]] = int(round(avg))
                except Exception:
                    continue

    return results
