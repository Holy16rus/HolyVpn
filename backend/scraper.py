import asyncio
import json
import os
import urllib.parse
from pathlib import Path
import httpx
from backend.parser import extract_proxies, path_score, SKIP_PATH_PARTS, TEXT_FILE_EXTENSIONS

TIMEOUT = 25


async def fetch_url(url, timeout=TIMEOUT):
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "HolyVPN-Proxy-Generator/2.0"})
        resp.raise_for_status()
        return resp.text


async def fetch_json(url, timeout=TIMEOUT):
    return json.loads(await fetch_url(url, timeout))


async def discover_repo_files(source, per_repo_limit, cancel_event):
    parsed = urllib.parse.urlparse(source.strip())
    host = parsed.netloc.lower()
    parts = parsed.path.strip("/").split("/")

    if host == "raw.githubusercontent.com" and len(parts) >= 4:
        return [{"url": source, "path": "/".join(parts[3:]), "source": source}]

    if host not in {"github.com", "www.github.com"} or len(parts) < 2:
        return [{"url": source, "path": source, "source": source}]

    owner, repo = parts[0], parts[1].removesuffix(".git")

    if len(parts) >= 5 and parts[2] in {"blob", "raw"}:
        branch = parts[3]
        file_path = "/".join(parts[4:])
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"
        return [{"url": raw_url, "path": file_path, "source": source}]

    branch = parts[3] if len(parts) >= 5 and parts[2] == "tree" else await _default_branch(owner, repo)
    prefix = "/".join(parts[4:]).strip("/") if len(parts) >= 5 and parts[2] == "tree" else ""

    if cancel_event.is_set():
        return []

    try:
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        tree = (await fetch_json(tree_url)).get("tree", [])
    except Exception:
        return common_repo_candidates(owner, repo, source, per_repo_limit)
    candidates = []

    for item in tree:
        if cancel_event.is_set():
            return []
        path = item.get("path", "")
        if item.get("type") != "blob":
            continue
        if prefix and not path.startswith(prefix.rstrip("/") + "/") and path != prefix:
            continue
        score = path_score(path)
        if score < 0:
            continue
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
        candidates.append({"url": raw_url, "path": path, "source": source, "score": score})

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:per_repo_limit]


def common_repo_candidates(owner, repo, source, per_repo_limit):
    paths = [
        "http.txt", "https.txt", "socks5.txt", "socks4.txt",
        "proxy.txt", "proxies.txt", "all.txt", "README.md",
        "data/http.txt", "data/https.txt", "data/socks5.txt", "data/proxies.txt",
        "proxies/http.txt", "proxies/https.txt", "proxies/socks5.txt", "proxies/all.txt",
    ]
    candidates = []
    for branch in ("main", "master"):
        for path in paths:
            candidates.append({
                "url": f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}",
                "path": path,
                "source": source,
                "score": path_score(path),
            })
            if len(candidates) >= per_repo_limit:
                return candidates
    return candidates


async def _default_branch(owner, repo):
    try:
        data = await fetch_json(f"https://api.github.com/repos/{owner}/{repo}")
        return data.get("default_branch", "main")
    except Exception:
        return "main"


async def fetch_and_parse(item, cancel_event):
    if cancel_event.is_set():
        return item, []
    try:
        content = await fetch_url(item["url"], timeout=20)
        nodes = extract_proxies(content, item["path"], item["source"])
        return item, nodes
    except Exception:
        return item, []


async def collect_from_sources(sources, per_repo_limit, cancel_event, progress_cb=None):
    all_nodes = []
    total_sources = len(sources)

    for idx, source in enumerate(sources):
        if cancel_event.is_set():
            break
        if progress_cb:
            await progress_cb("source", {"current": idx + 1, "total": total_sources, "url": source})

        try:
            files = await discover_repo_files(source, per_repo_limit, cancel_event)
        except Exception as e:
            if progress_cb:
                await progress_cb("error", {"msg": f"Source failed: {source}", "error": str(e)})
            continue

        sem = asyncio.Semaphore(10)

        async def process_file(item):
            if cancel_event.is_set():
                return []
            async with sem:
                _, nodes = await fetch_and_parse(item, cancel_event)
                if nodes and progress_cb:
                    await progress_cb("parsed", {"count": len(nodes), "path": item["path"], "source": source})
                return nodes

        tasks = [process_file(f) for f in files]
        for task in asyncio.as_completed(tasks):
            if cancel_event.is_set():
                break
            nodes = await task
            all_nodes.extend(nodes)

    return all_nodes


async def collect_local_files(files):
    root = Path(__file__).resolve().parent.parent
    all_nodes = []
    for path in files:
        full = root / path
        if not full.exists():
            continue
        try:
            content = full.read_text("utf-8", errors="replace")
        except Exception:
            continue
        nodes = extract_proxies(content, str(full), str(full))
        all_nodes.extend(nodes)
    return all_nodes
