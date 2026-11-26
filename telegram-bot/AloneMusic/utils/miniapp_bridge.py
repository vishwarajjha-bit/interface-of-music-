"""
Bridge synchronizing AloneMusic PyTgCalls Voice Chat sessions with the Ondine Mini App.
- Pushes live VC playback state, queue, group title, and verified admin IDs per chat_id.
- Polls /api/bot/commands and executes admin-verified remote controls in PyTgCalls.
"""

import asyncio
import logging
from typing import Any, Dict, List

import httpx
from pyrogram.enums import ChatMembersFilter

import config
from AloneMusic import YouTube, app
from AloneMusic.misc import db
from AloneMusic.utils.database import is_music_playing, music_off, music_on
from AloneMusic.utils.formatters import check_duration, seconds_to_min
from AloneMusic.utils.thumbnails import get_thumb


async def _fetch_group_meta(chat_id: int) -> Dict[str, Any]:
    title = f"Group {chat_id}"
    admin_ids: List[int] = list(config.adminlist.get(chat_id, []))
    try:
        chat = await app.get_chat(chat_id)
        if getattr(chat, "title", None):
            title = chat.title
    except Exception:
        pass

    if not admin_ids:
        try:
            async for member in app.get_chat_members(
                chat_id, filter=ChatMembersFilter.ADMINISTRATORS
            ):
                if member.user and not member.user.is_bot:
                    admin_ids.append(member.user.id)
            config.adminlist[chat_id] = admin_ids
        except Exception:
            pass

    return {"groupTitle": title, "adminIds": admin_ids}


def _headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if getattr(config, "BOT_BRIDGE_SECRET", ""):
        headers["x-bot-secret"] = config.BOT_BRIDGE_SECRET
    return headers


async def sync_chat_state(chat_id: int) -> None:
    server_url = getattr(config, "MINI_APP_SERVER_URL", "").rstrip("/")
    if not server_url:
        return

    playing = db.get(chat_id)
    meta = await _fetch_group_meta(chat_id)

    if not playing:
        payload = {
            "chatId": str(chat_id),
            "groupTitle": meta["groupTitle"],
            "isPlaying": False,
            "progress": 0,
            "duration": 0,
            "speed": 1,
            "currentTrack": None,
            "queue": [],
            "adminIds": meta["adminIds"],
        }
    else:
        head = playing[0]
        is_play = await is_music_playing(chat_id)
        current_track = {
            "vidid": str(head.get("vidid", "")),
            "title": str(head.get("title", "Unknown Track")).title(),
            "artist": f"Requested by {head.get('by', 'Member')}",
            "duration": int(head.get("seconds") or 0),
            "coverUrl": f"https://i.ytimg.com/vi/{head.get('vidid', '')}/hqdefault.jpg",
            "requestedBy": str(head.get("by", "Member")),
            "streamType": str(head.get("streamtype", "audio")),
        }
        queue_items = [
            {
                "vidid": str(item.get("vidid", "")),
                "title": str(item.get("title", "Queued Track")).title(),
                "artist": f"Requested by {item.get('by', 'Member')}",
                "duration": int(item.get("seconds") or 0),
                "coverUrl": f"https://i.ytimg.com/vi/{item.get('vidid', '')}/hqdefault.jpg",
                "requestedBy": str(item.get("by", "Member")),
                "streamType": str(item.get("streamtype", "audio")),
            }
            for item in playing[1:]
        ]
        payload = {
            "chatId": str(chat_id),
            "groupTitle": meta["groupTitle"],
            "isPlaying": bool(is_play),
            "progress": int(head.get("played") or 0),
            "duration": int(head.get("seconds") or 0),
            "speed": float(head.get("speed") or 1.0),
            "currentTrack": current_track,
            "queue": queue_items,
            "adminIds": meta["adminIds"],
        }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{server_url}/api/bot/vc-state",
                json=payload,
                headers=_headers(),
            )
    except Exception as exc:
        logging.debug("MiniApp VC state sync skipped: %s", exc)


async def _execute_remote_command(cmd: Dict[str, Any]) -> None:
    from AloneMusic.core.call import Alone
    from AloneMusic.utils.stream.queue import put_queue

    chat_id_raw = cmd.get("chatId")
    if not chat_id_raw:
        return
    chat_id = int(chat_id_raw)
    action = cmd.get("action")
    payload = cmd.get("payload") or {}
    issued_by = str(cmd.get("issuedBy") or "Group Admin")

    check = db.get(chat_id)
    if not check and action not in ("play", "enqueue"):
        return

    try:
        if action == "pause":
            await music_off(chat_id)
            await Alone.pause_stream(chat_id)
        elif action == "resume":
            await music_on(chat_id)
            await Alone.resume_stream(chat_id)
        elif action == "stop":
            await Alone.stop_stream(chat_id)
        elif action == "replay":
            queued = check[0]["file"]
            status = True if str(check[0].get("streamtype")) == "video" else None
            db[chat_id][0]["played"] = 0
            await Alone.skip_stream(chat_id, queued, video=status)
        elif action == "skip":
            popped = check.pop(0) if check else None
            if not check:
                await Alone.stop_stream(chat_id)
            else:
                nxt = check[0]
                queued = nxt["file"]
                status = True if str(nxt.get("streamtype")) == "video" else None
                db[chat_id][0]["played"] = 0
                if "vid_" in queued:
                    fp, _direct = await YouTube.download(
                        nxt["vidid"], None, videoid=True, video=status
                    )
                    queued = fp
                await Alone.skip_stream(chat_id, queued, video=status)
        elif action == "seek":
            to_seek = int(payload.get("seconds") or 0)
            dur_sec = int(check[0].get("seconds") or 0)
            file_path = check[0]["file"]
            status = True if str(check[0].get("streamtype")) == "video" else None
            db[chat_id][0]["played"] = to_seek
            await Alone.seek_stream(
                chat_id,
                file_path,
                seconds_to_min(to_seek),
                seconds_to_min(dur_sec),
                status,
            )
        elif action == "speed":
            spd = str(payload.get("speed") or "1.0")
            file_path = check[0]["file"]
            await Alone.speedup_stream(chat_id, file_path, spd, check)
        elif action == "remove_queue":
            idx = int(payload.get("index") or -1) + 1
            if 1 <= idx < len(check):
                check.pop(idx)
        elif action == "jump_queue":
            idx = int(payload.get("index") or -1) + 1
            if 1 <= idx < len(check):
                target = check.pop(idx)
                check[0] = target
                queued = target["file"]
                status = True if str(target.get("streamtype")) == "video" else None
                if "vid_" in queued:
                    fp, _direct = await YouTube.download(
                        target["vidid"], None, videoid=True, video=status
                    )
                    queued = fp
                db[chat_id][0]["played"] = 0
                await Alone.skip_stream(chat_id, queued, video=status)
        elif action in ("enqueue", "play"):
            track = payload.get("track") or {}
            vidid = track.get("vidid")
            title = track.get("title") or "Requested Track"
            if vidid:
                fp, _direct = await YouTube.download(vidid, None, videoid=True)
                dur_sec = int(track.get("duration") or 180)
                dur_min = seconds_to_min(dur_sec)
                if not check:
                    db[chat_id] = []
                    await Alone.join_call(chat_id, chat_id, fp, video=False)
                await put_queue(
                    chat_id,
                    chat_id,
                    fp,
                    title,
                    dur_min,
                    issued_by,
                    vidid,
                    0,
                    "audio",
                )
    except Exception as exc:
        logging.warning("MiniApp VC command '%s' failed for %s: %s", action, chat_id, exc)
    finally:
        await sync_chat_state(chat_id)


async def miniapp_command_worker() -> None:
    server_url = getattr(config, "MINI_APP_SERVER_URL", "").rstrip("/")
    if not server_url:
        return
    while True:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{server_url}/api/bot/commands",
                    headers=_headers(),
                )
                if resp.status_code == 200:
                    commands = resp.json().get("commands", [])
                    for cmd in commands:
                        await _execute_remote_command(cmd)
        except Exception:
            pass
        await asyncio.sleep(1.5)
