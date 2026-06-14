import asyncio
import time
from backend.config import OUTPUT_FILE
from backend.parser import dedupe
from backend.scraper import collect_from_sources, collect_local_files
from backend.checker import check_batch
from backend.services import geoip_batch, proxycheck_risk, globalping_ping
from backend.generator import select_nodes, generate_config


class ProxyEngine:
    def __init__(self):
        self.cancel_event = asyncio.Event()
        self.status = "idle"
        self.metrics = {
            "total_sources": 0,
            "current_source": 0,
            "candidates": 0,
            "deduped": 0,
            "checking_progress": 0,
            "checking_total": 0,
            "live": 0,
            "geo_checked": 0,
            "ping_checked": 0,
            "selected": 0,
            "countries": 0,
        }
        self.events = asyncio.Queue()
        self._task = None

    def reset(self):
        self.cancel_event.clear()
        self.status = "running"
        self.metrics = {k: 0 for k in self.metrics}

    async def emit(self, event, data=None):
        await self.events.put({"event": event, "data": data or {}, "time": time.time()})

    async def emit_metrics(self):
        await self.emit("metrics", dict(self.metrics))

    async def run(self, sources, local_files, opts):
        self.reset()
        try:
            await self.emit("status", {"status": "running", "message": "Сбор прокси из источников..."})

            nodes = await collect_local_files(local_files)
            if sources:
                async def source_progress(event, data):
                    if event == "source":
                        self.metrics["current_source"] = data.get("current", 0)
                        self.metrics["total_sources"] = data.get("total", 0)
                        await self.emit("status", {"status": "running", "message": f"Сканирование: {data.get('url', '')[:60]}..."})
                    elif event == "parsed":
                        self.metrics["candidates"] += data.get("count", 0)
                        await self.emit_metrics()
                        await self.emit("status", {"status": "running", "message": f"+{data.get('count', 0)} из {data.get('path', '')[:50]}"})
                    elif event == "error":
                        await self.emit("log", {"level": "warn", "text": data.get("msg", "")})

                remote = await collect_from_sources(sources, 80, self.cancel_event, source_progress)
                nodes.extend(remote)

            if self.cancel_event.is_set():
                self.status = "cancelled"
                await self.emit("status", {"status": "cancelled", "message": "Отменено"})
                return

            self.metrics["candidates"] = len(nodes)
            await self.emit("status", {"status": "running", "message": "Дедупликация..."})
            nodes = dedupe(nodes)
            self.metrics["deduped"] = len(nodes)
            await self.emit_metrics()

            if self.cancel_event.is_set():
                self.status = "cancelled"
                return

            if not nodes:
                self.status = "error"
                await self.emit("status", {"status": "error", "message": "Нет прокси для проверки"})
                return

            limit = opts.get("limit", 100)
            max_checks = opts.get("max_checks", 0)
            timeout = opts.get("timeout", 10)

            nodes_to_check = nodes[:max_checks] if max_checks > 0 else nodes

            await self.emit("status", {"status": "running", "message": f"Проверка {len(nodes_to_check)} прокси..."})

            async def check_progress(checked, total, live):
                self.metrics["checking_progress"] = checked
                self.metrics["checking_total"] = total
                self.metrics["live"] = live
                await self.emit_metrics()

            live_nodes = await check_batch(nodes_to_check, timeout, self.cancel_event, check_progress)

            if self.cancel_event.is_set():
                self.status = "cancelled"
                return

            self.metrics["live"] = len(live_nodes)
            await self.emit_metrics()

            if not live_nodes:
                self.status = "error"
                await self.emit("status", {"status": "error", "message": "Нет живых прокси"})
                return

            await self.emit("status", {"status": "running", "message": "Определение стран через ip-api.com..."})

            unique_ips = list(dict.fromkeys(n.get("server", "") for n in live_nodes if n.get("server")))
            geo_data = await geoip_batch(unique_ips, self.cancel_event)
            self.metrics["geo_checked"] = len(geo_data)
            await self.emit_metrics()

            await self.emit("status", {"status": "running", "message": "Проверка риска через proxycheck.io..."})
            risk_data = await proxycheck_risk(unique_ips, self.cancel_event)
            for ip, risk in risk_data.items():
                geo_data.setdefault(ip, {}).update(risk)

            for node in live_nodes:
                ip = node.get("server", "")
                if ip in geo_data:
                    info = geo_data[ip]
                    if node.get("country", "ZZ") == "ZZ":
                        node["country"] = info.get("country", "ZZ")
                    node["risk"] = info.get("risk")
                    node["proxy_type"] = info.get("type")
                    if info.get("lat") is not None and info.get("lon") is not None:
                        node["lat"] = info.get("lat")
                        node["lon"] = info.get("lon")

            geo_points = [
                {
                    "lat": n.get("lat"),
                    "lon": n.get("lon"),
                    "country": n.get("country", "ZZ"),
                    "latency_ms": n.get("latency_ms"),
                }
                for n in live_nodes
                if n.get("lat") is not None and n.get("lon") is not None
            ]
            await self.emit("geo_points", {"points": geo_points})

            known = sum(1 for n in live_nodes if n.get("country") != "ZZ")
            await self.emit("log", {"level": "info", "text": f"GeoIP: {known}/{len(live_nodes)} определено"})

            await self.emit("status", {"status": "running", "message": "Замер пинга через Globalping..."})
            ping_data = await globalping_ping(live_nodes[:500], self.cancel_event)
            self.metrics["ping_checked"] = len(ping_data)
            for node in live_nodes:
                ip = node.get("server", "")
                if ip in ping_data:
                    node["globalping_ms"] = ping_data[ip]

            await self.emit_metrics()

            await self.emit("status", {"status": "running", "message": "Финальный отбор..."})

            strategy = opts.get("selection", "fastest")
            selected = select_nodes(live_nodes, limit, strategy)

            self.metrics["selected"] = len(selected)
            countries = {n.get("country", "ZZ") for n in selected}
            self.metrics["countries"] = len(countries)
            await self.emit_metrics()

            config_yaml = generate_config(selected)
            OUTPUT_FILE.write_text(config_yaml, "utf-8")

            self.status = "done"
            await self.emit("status", {"status": "done", "message": f"Готово: {len(selected)} прокси, {len(countries)} стран"})
            await self.emit("done", {"path": str(OUTPUT_FILE), "count": len(selected)})

        except Exception as e:
            self.status = "error"
            await self.emit("status", {"status": "error", "message": str(e)})
            await self.emit("log", {"level": "error", "text": f"Ошибка: {e}"})

    def cancel(self):
        self.cancel_event.set()

    @property
    def is_running(self):
        return self.status == "running"
