import asyncio
import sys
import time
from pathlib import Path

from backend.config import OUTPUT_FILE, load_sources
from backend.scraper import collect_from_sources
from backend.parser import dedupe
from backend.checker import check_batch
from backend.services import geoip_batch, proxycheck_risk, globalping_ping
from backend.generator import select_nodes, generate_config


async def run():
    config = load_sources()
    sources = [
        s.get("url") if isinstance(s, dict) else s
        for s in config.get("sources", [])
        if not isinstance(s, dict) or s.get("enabled", True)
    ]
    local_files = config.get("local_files", ["proxy.txt"])

    print(f"[*] Sources: {len(sources)} remote, {len(local_files)} local")

    cancel = asyncio.Event()
    all_nodes = []

    if local_files:
        for path in local_files:
            full = Path(__file__).resolve().parent.parent / path
            if not full.exists():
                continue
            from backend.parser import extract_proxies
            try:
                content = full.read_text("utf-8", errors="replace")
                nodes = extract_proxies(content, str(full), str(full))
                print(f"  [+] {full.name}: {len(nodes)} proxies")
                all_nodes.extend(nodes)
            except Exception as e:
                print(f"  [!] {full.name}: {e}")

    if sources:
        async def progress(event, data):
            if event == "source":
                print(f"  [>] Scanning: {data.get('url', '')[:60]}...")
            elif event == "parsed":
                print(f"  [+] +{data['count']} from {data['path'][:50]}")
            elif event == "error":
                print(f"  [!] {data.get('msg', '')}")

        remote = await collect_from_sources(sources, 80, cancel, progress)
        all_nodes.extend(remote)

    print(f"\n[*] Candidates: {len(all_nodes)}")
    all_nodes = dedupe(all_nodes)
    print(f"[*] After dedup: {len(all_nodes)}")

    if not all_nodes:
        print("[!] No proxies to check")
        sys.exit(1)

    print("\n[*] Checking proxies...")
    live = []

    async def check_progress(checked, total, live_count):
        if checked % 200 == 0 or checked == total:
            print(f"  [{checked}/{total}] live: {live_count}")

    live = await check_batch(all_nodes[:10000], 8, cancel, check_progress)

    print(f"\n[*] Live: {len(live)}")

    if not live:
        print("[!] No live proxies found")
        sys.exit(1)

    print("[*] GeoIP lookup...")
    unique_ips = list(dict.fromkeys(n.get("server", "") for n in live if n.get("server")))
    geo_data = await geoip_batch(unique_ips, cancel)
    print(f"  [+] GeoIP: {len(geo_data)}/{len(unique_ips)}")

    print("[*] Risk check...")
    risk_data = await proxycheck_risk(unique_ips, cancel)
    for ip, risk in risk_data.items():
        geo_data.setdefault(ip, {}).update(risk)

    for node in live:
        ip = node.get("server", "")
        if ip in geo_data:
            info = geo_data[ip]
            if node.get("country", "ZZ") == "ZZ":
                node["country"] = info.get("country", "ZZ")
            node["risk"] = info.get("risk")
            if info.get("lat") is not None and info.get("lon") is not None:
                node["lat"] = info.get("lat")
                node["lon"] = info.get("lon")

    known = sum(1 for n in live if n.get("country") != "ZZ")
    print(f"  [+] Countries known: {known}/{len(live)}")

    print("[*] Ping measurement...")
    ping_data = await globalping_ping(live[:500], cancel)
    for node in live:
        ip = node.get("server", "")
        if ip in ping_data:
            node["globalping_ms"] = ping_data[ip]
    print(f"  [+] Pinged: {len(ping_data)}")

    print("[*] Final selection...")
    selected = select_nodes(live, 500, "fastest")
    countries = {n.get("country", "ZZ") for n in selected}
    print(f"  [+] Selected: {len(selected)} from {len(countries)} countries")

    yaml = generate_config(selected)
    OUTPUT_FILE.write_text(yaml, "utf-8")
    print(f"\n[+] Config saved: {OUTPUT_FILE}")
    print(f"    Total: {len(selected)} proxies, {len(countries)} countries")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(run())
    elapsed = time.time() - start
    print(f"\n[+] Done in {elapsed:.1f}s")
