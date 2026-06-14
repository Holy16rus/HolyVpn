#!/usr/bin/env python3
"""HolyVPN Proxy Generator v2 — FastAPI + React"""
import asyncio
import signal
import uvicorn


class ServerKiller:
    should_exit = False

    def __init__(self):
        if hasattr(signal, "SIGINT"):
            signal.signal(signal.SIGINT, self.exit)
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, self.exit)

    def exit(self, *args):
        self.should_exit = True


if __name__ == "__main__":
    killer = ServerKiller()
    config = uvicorn.Config(
        "backend.main:app",
        host="127.0.0.1",
        port=1488,
        reload=False,
        log_level="info",
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except KeyboardInterrupt:
        pass
