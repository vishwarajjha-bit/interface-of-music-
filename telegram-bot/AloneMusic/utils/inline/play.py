#
# Copyright (C) 2021-2022 by TheAloneteam@Github, < https://github.com/TheAloneTeam >.
#
# This file is part of < https://github.com/TheAloneTeam/AloneMusic > project,
# and is released under the "GNU v3.0 License Agreement".
# Please see < https://github.com/TheAloneTeam/AloneMusic/blob/master/LICENSE >
#
# All rights reserved.

import inspect
import math

from pyrogram.types import InlineKeyboardButton

import config
from AloneMusic import app
from AloneMusic.utils.formatters import time_to_seconds

_SUPPORTS_STYLE = "style" in inspect.signature(InlineKeyboardButton.__init__).parameters


def _btn(text: str, style: str | None = None, **kwargs) -> InlineKeyboardButton:
    """Create a colorful InlineKeyboardButton when Pyrofork/Bot API style is supported."""
    if _SUPPORTS_STYLE and style in ("primary", "success", "danger"):
        kwargs["style"] = style
    return InlineKeyboardButton(text=text, **kwargs)


def _vc_miniapp_url(chat_id: int | str) -> str:
    short_name = getattr(config, "MINI_APP_SHORT_NAME", "").strip()
    if short_name:
        return f"https://t.me/{app.username}/{short_name}?startapp=vc_{chat_id}"
    return f"https://t.me/{app.username}?startapp=vc_{chat_id}"


def _advanced_control_row(chat_id: int | str):
    return [
        _btn(
            text="🎛️ Advanced Music Control",
            style="primary",
            url=_vc_miniapp_url(chat_id),
        )
    ]


def track_markup(_, videoid, user_id, channel, fplay):
    buttons = [
        [
            _btn(
                text=_["P_B_1"],
                style="success",
                callback_data=f"MusicStream {videoid}|{user_id}|a|{channel}|{fplay}",
            ),
            _btn(
                text=_["P_B_2"],
                style="primary",
                callback_data=f"MusicStream {videoid}|{user_id}|v|{channel}|{fplay}",
            ),
        ],
    ]
    return buttons


def stream_markup_timer(_, chat_id, played, dur):
    played_sec = time_to_seconds(played)
    duration_sec = time_to_seconds(dur)

    remaining_sec = duration_sec - played_sec
    remaining_sec = max(remaining_sec, 0)

    rem_min = remaining_sec // 60
    rem_sec = remaining_sec % 60
    remaining = f"{rem_min:02d}:{rem_sec:02d}"

    percentage = (played_sec / duration_sec) * 100 if duration_sec else 0
    umm = math.floor(percentage)

    if 0 < umm <= 10:
        bar = "|♬—————————|"
    elif 10 < umm < 20:
        bar = "|—♬————————|"
    elif 20 <= umm < 30:
        bar = "|——♬———————|"
    elif 30 <= umm < 40:
        bar = "|———♬——————|"
    elif 40 <= umm < 50:
        bar = "|————♬—————|"
    elif 50 <= umm < 60:
        bar = "|—————♬————|"
    elif 60 <= umm < 70:
        bar = "|——————♬———|"
    elif 70 <= umm < 80:
        bar = "|———————♬——|"
    elif 80 <= umm < 95:
        bar = "|————————♬—|"
    else:
        bar = "|—————————♬|"

    buttons = [
        [
            _btn(
                text=f"{played} {bar} {remaining}",
                style="primary",
                url=f"https://t.me/{app.username}?startgroup=true",
            )
        ],
        [
            _btn(text="🟢 ▷", style="success", callback_data=f"ADMIN Resume|{chat_id}"),
            _btn(text="🟡 II", style="primary", callback_data=f"ADMIN Pause|{chat_id}"),
            _btn(text="🔵 ‣‣I", style="primary", callback_data=f"ADMIN Skip|{chat_id}"),
            _btn(text="🟣 ↻", style="success", callback_data=f"ADMIN Replay|{chat_id}"),
            _btn(text="🔴 ▢", style="danger", callback_data=f"ADMIN Stop|{chat_id}"),
        ],
        [
            _btn(text="✖ ᴄʟᴏsᴇ", style="danger", callback_data="close"),
        ],
        _advanced_control_row(chat_id),
    ]
    return buttons


def stream_markup(_, chat_id):
    buttons = [
        [
            _btn(text="🟢 ▷", style="success", callback_data=f"ADMIN Resume|{chat_id}"),
            _btn(text="🟡 II", style="primary", callback_data=f"ADMIN Pause|{chat_id}"),
            _btn(text="🟣 ↻", style="success", callback_data=f"ADMIN Replay|{chat_id}"),
            _btn(text="🔵 ‣‣I", style="primary", callback_data=f"ADMIN Skip|{chat_id}"),
            _btn(text="🔴 ▢", style="danger", callback_data=f"ADMIN Stop|{chat_id}"),
        ],
        [
            _btn(text=_["CLOSE_BUTTON"], style="danger", callback_data="close"),
        ],
        _advanced_control_row(chat_id),
    ]
    return buttons


def playlist_markup(_, videoid, user_id, ptype, channel, fplay):
    buttons = [
        [
            _btn(
                text=_["P_B_1"],
                style="success",
                callback_data=f"AnonyPlaylists {videoid}|{user_id}|{ptype}|a|{channel}|{fplay}",
            ),
            _btn(
                text=_["P_B_2"],
                style="primary",
                callback_data=f"AnonyPlaylists {videoid}|{user_id}|{ptype}|v|{channel}|{fplay}",
            ),
        ],
        [
            _btn(
                text=_["CLOSE_BUTTON"],
                style="danger",
                callback_data=f"forceclose {videoid}|{user_id}",
            ),
        ],
    ]
    return buttons


def livestream_markup(_, videoid, user_id, mode, channel, fplay):
    buttons = [
        [
            _btn(
                text=_["P_B_3"],
                style="success",
                callback_data=f"LiveStream {videoid}|{user_id}|{mode}|{channel}|{fplay}",
            ),
        ],
        [
            _btn(
                text=_["CLOSE_BUTTON"],
                style="danger",
                callback_data=f"forceclose {videoid}|{user_id}",
            ),
        ],
    ]
    return buttons


def slider_markup(_, videoid, user_id, query, query_type, channel, fplay):
    query = f"{query[:20]}"
    buttons = [
        [
            _btn(
                text=_["P_B_1"],
                style="success",
                callback_data=f"MusicStream {videoid}|{user_id}|a|{channel}|{fplay}",
            ),
            _btn(
                text=_["P_B_2"],
                style="primary",
                callback_data=f"MusicStream {videoid}|{user_id}|v|{channel}|{fplay}",
            ),
        ],
        [
            _btn(
                text="◁",
                style="primary",
                callback_data=f"slider B|{query_type}|{query}|{user_id}|{channel}|{fplay}",
            ),
            _btn(
                text=_["CLOSE_BUTTON"],
                style="danger",
                callback_data=f"forceclose {query}|{user_id}",
            ),
            _btn(
                text="▷",
                style="primary",
                callback_data=f"slider F|{query_type}|{query}|{user_id}|{channel}|{fplay}",
            ),
        ],
    ]
    return buttons
