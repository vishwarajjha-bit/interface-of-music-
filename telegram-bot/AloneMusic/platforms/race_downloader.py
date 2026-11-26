"""
Multi-source concurrent download & API racer for AloneMusic.
Races:
  1. https://www.riteshyt.in
  2. https://api.riteshyt.in
  3. https://web.riteshyt.in
  4. https://yt.riteshyt.in
  5. Local yt-dlp

The first source to finish a valid media file wins immediately; all slower tasks
and subprocesses are cancelled and every half-downloaded .part/.temp file is deleted.
"""

import asyncio
import glob
import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

import httpx

DEFAULT_MIRRORS = [
    "https://www.riteshyt.in",
    "https://api.riteshyt.in",
    "https://web.riteshyt.in",
    "https://yt.riteshyt.in",
]


def get_music_api_key() -> str:
    return (
        os.getenv("MUSIC_API_KEY")
        or os.getenv("API_KEY")
        or os.getenv("ALONE_API_KEY")
        or os.getenv("RITESH_API_KEY")
        or ""
    ).strip()


def get_music_mirrors() -> List[str]:
    raw = os.getenv("MUSIC_API_URLS", "").strip()
    if raw:
        mirrors = [u.strip().rstrip("/") for u in raw.split(",") if u.strip()]
        if mirrors:
            return mirrors
    single = os.getenv("API_URL", "").strip().rstrip("/")
    if single and single not in DEFAULT_MIRRORS:
        return [single, *DEFAULT_MIRRORS]
    return list(DEFAULT_MIRRORS)


def _cleanup_race_parts(race_prefix: str) -> None:
    for p in glob.glob(f"{race_prefix}*"):
        try:
            if os.path.isfile(p):
                os.remove(p)
        except Exception:
            pass


async def _download_mirror(
    mirror: str,
    query: str,
    dl_type: str,
    api_key: str,
    part_path: str,
) -> Tuple[str, str]:
    params: Dict[str, Any] = {"query": query, "dl_type": dl_type}
    if api_key:
        params["api_key"] = api_key

    os.makedirs(os.path.dirname(part_path), exist_ok=True)
    timeout = httpx.Timeout(300.0, connect=8.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            async with client.stream("GET", f"{mirror}/download", params=params) as resp:
                if resp.status_code != 200:
                    raise RuntimeError(f"{mirror} status {resp.status_code}")
                ctype = (resp.headers.get("content-type") or "").lower()
                if "application/json" in ctype or "text/html" in ctype:
                    raise RuntimeError(f"{mirror} returned non-media {ctype}")
                with open(part_path, "wb") as fh:
                    async for chunk in resp.aiter_bytes(65536):
                        fh.write(chunk)
        if not os.path.exists(part_path) or os.path.getsize(part_path) < 2048:
            raise RuntimeError(f"{mirror} downloaded empty file")
        return part_path, mirror
    except asyncio.CancelledError:
        if os.path.exists(part_path):
            try:
                os.remove(part_path)
            except Exception:
                pass
        raise
    except Exception:
        if os.path.exists(part_path):
            try:
                os.remove(part_path)
            except Exception:
                pass
        raise


async def _download_ytdlp(
    target_url: str,
    dl_type: str,
    part_prefix: str,
    ext: str,
) -> Tuple[str, str]:
    out_template = f"{part_prefix}.%(ext)s"
    fmt = (
        "(bestvideo[height<=?720][width<=?1280][ext=mp4])+(bestaudio[ext=m4a])/best[height<=?720]/best"
        if dl_type == "video"
        else "bestaudio[ext=m4a]/bestaudio/best"
    )
    cmd = [
        "yt-dlp",
        "--geo-bypass",
        "--no-check-certificate",
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "-f",
        fmt,
        "-o",
        out_template,
        target_url,
    ]
    proc: Optional[asyncio.subprocess.Process] = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp exited {proc.returncode}")
        matches = [
            p
            for p in glob.glob(f"{part_prefix}.*")
            if not p.endswith(".part") and not p.endswith(".ytdl") and os.path.getsize(p) > 2048
        ]
        if not matches:
            raise RuntimeError("yt-dlp produced no output")
        return matches[0], "yt-dlp"
    except asyncio.CancelledError:
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        _cleanup_race_parts(part_prefix)
        raise
    except Exception:
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        _cleanup_race_parts(part_prefix)
        raise


async def race_download_media(
    query_or_id: str,
    target_path: str,
    dl_type: str = "audio",
    yt_url: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Race all 4 riteshyt.in mirrors + local yt-dlp simultaneously.
    Returns (final_path, winning_source) on first success, cancelling losers
    and deleting all half-downloaded .part files.
    """
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 2048:
        return target_path, "cache"

    ext = "mp4" if dl_type == "video" else "mp3"
    race_id = uuid.uuid4().hex[:10]
    race_base = os.path.join(os.path.dirname(target_path), f".race_{race_id}")
    api_key = get_music_api_key()
    mirrors = get_music_mirrors()

    tasks: List[asyncio.Task[Tuple[str, str]]] = []
    for idx, mirror in enumerate(mirrors):
        part_path = f"{race_base}_m{idx}.{ext}.part"
        tasks.append(
            asyncio.create_task(
                _download_mirror(mirror, query_or_id, dl_type, api_key, part_path),
                name=f"mirror_{idx}",
            )
        )

    yt_target = yt_url or (
        query_or_id
        if str(query_or_id).startswith(("http://", "https://"))
        else f"https://www.youtube.com/watch?v={query_or_id}"
    )
    tasks.append(
        asyncio.create_task(
            _download_ytdlp(yt_target, dl_type, f"{race_base}_ytdlp", ext),
            name="ytdlp_racer",
        )
    )

    pending = set(tasks)
    winner_file: Optional[str] = None
    winner_source: Optional[str] = None

    try:
        while pending:
            done, pending = await asyncio.wait(
                pending, return_when=asyncio.FIRST_COMPLETED
            )
            for t in done:
                if t.cancelled():
                    continue
                exc = t.exception()
                if exc is not None:
                    continue
                part_file, src = t.result()
                if part_file and os.path.exists(part_file) and os.path.getsize(part_file) > 2048:
                    winner_file = part_file
                    winner_source = src
                    break
            if winner_file:
                break

        # Cancel all slower remaining downloaders immediately
        for t in pending:
            t.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

        if winner_file and os.path.exists(winner_file):
            os.replace(winner_file, target_path)
            _cleanup_race_parts(race_base)
            logging.info("Download race winner for %s: %s", query_or_id, winner_source)
            return target_path, winner_source

        _cleanup_race_parts(race_base)
        return None, None
    except Exception:
        for t in pending:
            t.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        _cleanup_race_parts(race_base)
        raise


async def race_api_json(
    path: str,
    params: Optional[Dict[str, Any]] = None,
    timeout_sec: float = 12.0,
) -> Optional[Dict[str, Any]]:
    """
    Query all 4 riteshyt.in mirrors concurrently for JSON endpoints
    (/search, /details, /playlist, /formats, /api/get, /api/lyrics, /api/mix).
    Returns the fastest valid JSON response and cancels remaining mirror requests.
    """
    api_key = get_music_api_key()
    req_params = dict(params or {})
    if api_key and "api_key" not in req_params:
        req_params["api_key"] = api_key

    clean_path = path if path.startswith("/") else f"/{path}"
    mirrors = get_music_mirrors()

    async def _fetch(mirror: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_sec, connect=6.0),
            follow_redirects=True,
        ) as client:
            resp = await client.get(f"{mirror}{clean_path}", params=req_params)
            if resp.status_code != 200:
                raise RuntimeError(f"{mirror}{clean_path} -> {resp.status_code}")
            data = resp.json()
            if not data:
                raise RuntimeError(f"{mirror}{clean_path} -> empty")
            return data

    tasks = {asyncio.create_task(_fetch(m)) for m in mirrors}
    try:
        while tasks:
            done, tasks = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                if t.cancelled() or t.exception() is not None:
                    continue
                res = t.result()
                for rem in tasks:
                    rem.cancel()
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                return res
    except Exception:
        for rem in tasks:
            rem.cancel()
    return None
