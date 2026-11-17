/* Rink Music: a Spotify remote for the scorekeeper's table.
   Talks to the Spotify Web API from the browser (PKCE login, no server). */
(() => {
  "use strict";

  const KEY = "rinkmusic.v1";
  const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative";
  const API = "https://api.spotify.com/v1";
  // One fixed song per button.
  const SLOTS = { home: "Home goal", away: "Away goal", pre: "Pre Game", warm1: "Warm Up 1", warm2: "Warm Up 2", int1: "Intermission 1", int2: "Intermission 2" };
  const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, "");

  // ---------- state ----------
  const blank = () => ({
    clientId: "",
    tokens: null,                 // {access, refresh, exp}
    tracks: {},                   // id -> {id, uri, name, artist, durationMs, cueMs}
    pools: { stoppage: [], penalty: [] },
    goals: { home: null, away: null, pre: null, warm1: null, warm2: null, int1: null, int2: null },
    settings: { fadeMs: 1500, deviceId: "", wake: true },
    penaltyIdx: 0,
    seeded: false,
  });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const o = Object.assign(blank(), JSON.parse(raw)); o.goals = Object.assign(blank().goals, o.goals); return o; }
    } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const parseCue = (str) => {
    str = String(str || "").trim();
    if (!str) return 0;
    const m = str.match(/^(\d+):(\d{1,2})$/);
    if (m) return (+m[1] * 60 + +m[2]) * 1000;
    if (/^\d+(\.\d+)?$/.test(str)) return Math.round(parseFloat(str) * 1000);
    return null;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastTimer;
  function toast(msg, err = false, ms = 3200) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "show" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = err ? "err" : ""), ms);
  }
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const randStr = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[x % 62]).join(""); };

  // ---------- auth (PKCE) ----------
  async function login() {
    const cid = ($("clientIdInput").value || S.clientId || "").trim();
    if (!/^[0-9a-f]{32}$/i.test(cid)) { toast("That Client ID doesn't look right. It's 32 letters and numbers.", true); return; }
    S.clientId = cid; save();
    const verifier = randStr(64);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    localStorage.setItem(KEY + ".pkce", verifier);
    // The state also carries the verifier + client id, so login still completes if iOS
    // opens the Spotify page in a separate browser sheet with its own storage.
    const state = b64url(new TextEncoder().encode(JSON.stringify({ v: verifier, c: cid })));
    const p = new URLSearchParams({
      response_type: "code", client_id: cid, scope: SCOPES, redirect_uri: REDIRECT,
      code_challenge_method: "S256", code_challenge: challenge, state,
    });
    location.href = "https://accounts.spotify.com/authorize?" + p;
  }

  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has("code") && !q.has("error")) return false;
    history.replaceState(null, "", REDIRECT);
    if (q.get("error")) { toast("Spotify login was cancelled: " + q.get("error"), true, 6000); return false; }
    let verifier = localStorage.getItem(KEY + ".pkce"), cid = S.clientId;
    try {
      const st = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(q.get("state").replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
      verifier = verifier || st.v; cid = cid || st.c;
    } catch (e) {}
    if (!verifier || !cid) { toast("Login got lost. Tap Connect Spotify again.", true, 6000); return false; }
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: REDIRECT, client_id: cid, code_verifier: verifier }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast("Spotify login failed: " + (j.error_description || j.error || r.status) + ". Check the Redirect URI in your Spotify app matches exactly.", true, 9000); return false; }
    S.clientId = cid;
    S.tokens = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000 };
    localStorage.removeItem(KEY + ".pkce");
    save();
    return true;
  }

  let refreshing = null;
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const r = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: S.tokens.refresh, client_id: S.clientId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        S.tokens = null; save(); show("setup");
        throw new Error("Spotify login expired. Tap Connect Spotify.");
      }
      S.tokens = { access: j.access_token, refresh: j.refresh_token || S.tokens.refresh, exp: Date.now() + j.expires_in * 1000 };
      save();
    })();
    try { await refreshing; } finally { refreshing = null; }
  }

  async function api(method, path, body, retried) {
    if (!S.tokens) throw new Error("Not signed in.");
    if (Date.now() > S.tokens.exp - 60000) await refresh();
    const r = await fetch(path.startsWith("http") ? path : API + path, {
      method,
      headers: Object.assign({ Authorization: "Bearer " + S.tokens.access }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && !retried) { await refresh(); return api(method, path, body, true); }
    if (r.status === 204 || r.status === 202) return null;
    const text = await r.text();
    let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) {
      const err = new Error((j && j.error && (j.error.message || j.error)) || "Spotify error " + r.status);
      err.status = r.status; err.reason = j && j.error && j.error.reason;
      throw err;
    }
    return j;
  }

  // ---------- devices ----------
  let device = null; // last chosen device object
  async function getDevices() {
    const j = await api("GET", "/me/player/devices");
    return (j && j.devices) || [];
  }
  let deviceAt = 0;
  async function pickDevice() {
    const list = await getDevices();
    lastDevices = list;
    let d = (S.settings.deviceId && list.find((x) => x.id === S.settings.deviceId))
      || list.find((x) => /smartphone/i.test(x.type) && x.is_active)
      || list.find((x) => /smartphone/i.test(x.type))
      || list.find((x) => x.is_active)
      || list[0] || null;
    device = d ? Object.assign({}, d) : null;
    deviceAt = Date.now();
    setStatus(!d);
    return device;
  }
  let lastDevices = [];

  // ---------- playback ----------
  let current = null;   // {id, kind}
  let isPlaying = false;
  let fadeToken = 0;

  // Songs to keep playing after the chosen one, so music never stops until Stop is pressed.
  function followUps(firstId) {
    const pool = S.pools.stoppage.filter((x) => S.tracks[x] && x !== firstId);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 40).map((x) => S.tracks[x].uri);
  }

  let playSeq = 0, lastCmdAt = 0, shuffleOffFor = null;
  // With Spotify's shuffle on, it starts a random song from the list instead of the one we asked
  // for, so goal and penalty buttons would play a stoppage song. Turn shuffle off first.
  async function ensureShuffleOff(d, force) {
    if (!force && shuffleOffFor === d.id) return;
    try { await api("PUT", "/me/player/shuffle?state=false&device_id=" + encodeURIComponent(d.id)); shuffleOffFor = d.id; } catch (e) {}
  }
  const sameTrack = (item, t) => !!item && (item.uri === t.uri || item.id === t.id ||
    (item.linked_from && (item.linked_from.uri === t.uri || item.linked_from.id === t.id)) ||
    (item.name === t.name && (item.artists || []).map((a) => a.name).join(", ") === t.artist));
  async function playTrack(id, kind) {
    const t = S.tracks[id];
    if (!t) { alertMsg("That song isn't in your list anymore."); return; }
    fadeToken++; // cancel any fade in progress
    const seq = ++playSeq;
    lastCmdAt = Date.now();
    clearAlert();
    let pos = t.cueMs || 0;
    if (t.durationMs && pos > t.durationMs - 5000) pos = 0;
    const body = { uris: [t.uri].concat(followUps(id)), offset: { position: 0 }, position_ms: pos };
    // optimistic UI so the button reacts instantly
    current = { id, kind }; isPlaying = true; showNow(t); setPlayBtn();
    try {
      let d = (device && Date.now() - deviceAt < 30000) ? device : await pickDevice();
      if (!d) throw Object.assign(new Error("no device"), { noDevice: true });
      if (!d.is_active) {
        // wake the phone up as the Spotify player first; playing to an idle device often does nothing
        await api("PUT", "/me/player", { device_ids: [d.id], play: false }).catch(() => {});
        d.is_active = true;
        await sleep(350);
      }
      await ensureShuffleOff(d);
      try {
        await api("PUT", "/me/player/play?device_id=" + encodeURIComponent(d.id), body);
      } catch (e) {
        if (e.status !== 404 && e.status !== 502 && e.status !== 503) throw e;
        d = await pickDevice();
        if (!d) throw Object.assign(new Error("no device"), { noDevice: true });
        await api("PUT", "/me/player", { device_ids: [d.id], play: false }).catch(() => {});
        await sleep(500);
        await api("PUT", "/me/player/play?device_id=" + encodeURIComponent(d.id), body);
      }
      if (restoreVol != null && d.supports_volume) {
        api("PUT", "/me/player/volume?volume_percent=" + restoreVol + "&device_id=" + encodeURIComponent(d.id)).catch(() => {});
        restoreVol = null;
      }
      setStatus();
      verifyPlaying(seq, t, d, body);
    } catch (e) {
      if (seq !== playSeq) return;
      isPlaying = false; setPlayBtn();
      playError(e);
    }
  }

  // Spotify can accept the command and still play nothing (usually: the Spotify app on the
  // phone was asleep). Check, retry once, and say so on screen instead of failing silently.
  async function verifyPlaying(seq, t, d, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(1500);
      if (seq !== playSeq) return;
      let p = null;
      try { p = await api("GET", "/me/player?additional_types=track"); } catch (e) { return; }
      if (seq !== playSeq) return;
      const ok = p && p.is_playing && sameTrack(p.item, t);
      if (ok) {
        if (p.device) { device = Object.assign({}, p.device); deviceAt = Date.now(); setStatus(); }
        return;
      }
      lastProblem = { when: new Date().toLocaleTimeString(), sent: t.name + " to " + d.name, state: p ? { is_playing: p.is_playing, device: p.device && p.device.name, track: p.item && p.item.name } : "nothing playing" };
      if (attempt === 0) {
        try {
          if (!(p && p.is_playing)) {
            await api("PUT", "/me/player", { device_ids: [d.id], play: false }).catch(() => {});
            await sleep(400);
          }
          await ensureShuffleOff(d, true);
          if (p && p.is_playing) {
            // Spotify played a different song from the list (shuffle). Play just the one song,
            // then queue a few more so the music still keeps going.
            await api("PUT", "/me/player/play?device_id=" + encodeURIComponent(d.id), { uris: [t.uri], position_ms: body.position_ms });
            queueFollowUps(seq, d, body.uris.slice(1, 6));
          } else {
            await api("PUT", "/me/player/play?device_id=" + encodeURIComponent(d.id), body);
          }
        } catch (e) { break; }
      }
    }
    if (seq !== playSeq) return;
    isPlaying = false; setPlayBtn(); setStatus(true);
    if (lastProblem && lastProblem.state && lastProblem.state.is_playing) {
      isPlaying = true; setPlayBtn(); setStatus();
      alertMsg(`Asked Spotify for "${t.name}" but it's playing "${lastProblem.state.track}". In the Spotify app, turn off Shuffle (the crossed-arrows button), then try again.`);
      return;
    }
    alertMsg(`Spotify took the command but nothing is playing on "${d.name}". Open the Spotify app on your phone, tap play on any song, come back here and press Play again. Also check your phone volume.`);
  }
  let lastProblem = null;
  async function queueFollowUps(seq, d, uris) {
    await sleep(800);
    for (const u of uris) {
      if (seq !== playSeq) return;
      await api("POST", "/me/player/queue?uri=" + encodeURIComponent(u) + "&device_id=" + encodeURIComponent(d.id)).catch(() => {});
    }
  }

  function playError(e) {
    lastProblem = { when: new Date().toLocaleTimeString(), error: e.message, status: e.status, reason: e.reason };
    if (e.noDevice || e.reason === "NO_ACTIVE_DEVICE" || e.status === 404) {
      alertMsg("Spotify can't find your phone. Open the Spotify app, play any song for a second, then come back and press Play again.");
    } else if (e.reason === "PREMIUM_REQUIRED" || e.status === 403) {
      alertMsg("Spotify refused to play: " + e.message + (e.reason ? " (" + e.reason + ")" : "") + ". Make sure you're signed in with your Premium account.");
    } else if (e.status === 429) {
      alertMsg("Spotify says slow down. Wait a few seconds and try again.");
    } else alertMsg("Spotify error: " + (e.message || "something went wrong") + (e.status ? " (" + e.status + ")" : ""));
    setStatus(true);
  }
  function alertMsg(text) {
    const el = $("alert");
    if (!el) return toast(text, true, 8000);
    el.querySelector("span").textContent = text;
    el.classList.remove("hidden");
  }
  function clearAlert() { const el = $("alert"); if (el) el.classList.add("hidden"); }

  let restoreVol = null;
  async function stop() {
    const my = ++fadeToken;
    playSeq++; lastCmdAt = Date.now(); clearAlert();
    const fadeMs = +S.settings.fadeMs || 0;
    isPlaying = false; setPlayBtn();
    try {
      const d = device;
      if (fadeMs > 0 && d && d.supports_volume) {
        const p = await api("GET", "/me/player");
        const start = p && p.device && p.device.volume_percent;
        if (start != null && start > 0) {
          restoreVol = start;
          const steps = 6;
          for (let i = 1; i <= steps; i++) {
            if (my !== fadeToken) return;
            const v = Math.round(start * (1 - i / steps));
            await api("PUT", "/me/player/volume?volume_percent=" + v + "&device_id=" + encodeURIComponent(d.id)).catch(() => {});
            await sleep(fadeMs / steps);
          }
          if (my !== fadeToken) return;
          await api("PUT", "/me/player/pause").catch(() => {});
          await api("PUT", "/me/player/volume?volume_percent=" + start + "&device_id=" + encodeURIComponent(d.id)).catch(() => {});
          restoreVol = null;
          return;
        }
      }
      await api("PUT", "/me/player/pause");
    } catch (e) {
      if (e.status !== 403 && e.status !== 404) playError(e); // 403/404 = already paused / nothing to pause
    }
  }

  // shuffle bag so songs don't repeat until the whole pool has played
  let bag = [];
  function nextStoppage() {
    const pool = S.pools.stoppage.filter((id) => S.tracks[id]);
    if (!pool.length) return null;
    bag = bag.filter((id) => pool.includes(id));
    if (!bag.length) {
      bag = pool.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && current && bag[bag.length - 1] === current.id) bag.unshift(bag.pop());
    }
    return bag.pop();
  }
  function nextPenalty() {
    const pool = S.pools.penalty.filter((id) => S.tracks[id]);
    if (!pool.length) return null;
    const id = pool[S.penaltyIdx % pool.length];
    S.penaltyIdx = (S.penaltyIdx + 1) % pool.length; save();
    return id;
  }

  // ---------- main screen ----------
  const ICON_PLAY = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
  const ICON_STOP = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>';
  function setPlayBtn() {
    const b = $("playBtn");
    document.body.classList.toggle("playing", isPlaying);
    if (isPlaying) { b.classList.add("stop"); b.innerHTML = ICON_STOP + "Stop<span class=\"sub\">" + (S.settings.fadeMs > 0 && device && device.supports_volume ? "fade out" : "pause the music") + "</span>"; }
    else { b.classList.remove("stop"); b.innerHTML = ICON_PLAY + "Play<span class=\"sub\">random stoppage song</span>"; }
  }
  function showNow(t) {
    $("nowName").textContent = t ? t.name : "Nothing playing";
    $("nowArtist").innerHTML = t ? esc(t.artist) + (t.cueMs ? " · cue " + fmt(t.cueMs) : "") : "&nbsp;";
  }
  function setStatus(bad) {
    const el = $("status");
    if (!el) return;
    if (device) el.innerHTML = `<span class="dot ${bad ? "bad" : "ok"}"></span>Playing on <b>${esc(device.name)}</b>`;
    else el.innerHTML = `<span class="dot ${bad ? "bad" : ""}"></span>${bad ? "Open Spotify on your phone" : "Ready"}`;
  }

  async function onPlay() {
    if (isPlaying) return stop();
    const id = nextStoppage();
    if (!id) { alertMsg("There are no songs in the Stoppage list, so there's nothing to play. Open Songs & settings and add some, or tap Settings → Re-add the starter songs."); return; }
    playTrack(id, "stoppage");
  }
  function onGoal(side) {
    const id = S.goals[side];
    if (!id) { alertMsg(`No ${SLOTS[side]} song is set. Search for one under Songs & settings → + Add songs, then use "Set as…".`); return; }
    playTrack(id, side);
  }
  function onPenalty() {
    const id = nextPenalty();
    if (!id) { alertMsg("There are no songs in the Penalty list yet. Add some under Songs & settings."); return; }
    playTrack(id, "penalty");
  }
  function onSkip() {
    const id = nextStoppage();
    if (id) playTrack(id, "stoppage");
  }
  function onReplay() {
    if (current) playTrack(current.id, current.kind);
    else toast("Nothing to restart yet.");
  }

  async function markCue() {
    try {
      const p = await api("GET", "/me/player?additional_types=track");
      if (!p || !p.item) { toast("Nothing is playing in Spotify right now.", true); return; }
      const it = p.item;
      if (it.explicit) toast("Heads up: this version is marked explicit.", true);
      let t = S.tracks[it.id];
      if (!t) {
        t = addTrack(it);
        toast(`Saved cue ${fmt(p.progress_ms)} for "${it.name}". It isn't in a pool yet; add it under Songs.`);
      } else toast(`Cue for "${t.name}" set to ${fmt(p.progress_ms)}.`);
      t.cueMs = p.progress_ms; save();
      showNow(t); renderLib();
    } catch (e) { playError(e); }
  }

  // poll now-playing so the label and button stay honest if Spotify was changed elsewhere
  async function poll() {
    if (document.hidden || $("main").classList.contains("hidden") || !S.tokens) return;
    if (Date.now() - lastCmdAt < 5000) return; // don't fight a command that's still landing
    try {
      const p = await api("GET", "/me/player?additional_types=track");
      if (!p) { if (isPlaying) { isPlaying = false; setPlayBtn(); } return; }
      if (p.device && device && p.device.id === device.id) { Object.assign(device, p.device); setStatus(); }
      isPlaying = !!p.is_playing; setPlayBtn();
      if (p.item) {
        const t = S.tracks[p.item.id] || { name: p.item.name, artist: (p.item.artists || []).map((a) => a.name).join(", ") };
        showNow(t);
      }
    } catch (e) { /* stay quiet while polling */ }
  }

  // ---------- library ----------
  function addTrack(it) {
    const t = S.tracks[it.id] || {
      id: it.id, uri: it.uri, name: it.name,
      artist: (it.artists || []).map((a) => a.name).join(", "),
      durationMs: it.duration_ms, cueMs: 0,
    };
    S.tracks[it.id] = t;
    return t;
  }
  function addToPool(pool, it) {
    if (it.explicit) { toast("Skipped: explicit version.", true); return false; }
    addTrack(it);
    if (!S.pools[pool].includes(it.id)) S.pools[pool].push(it.id);
    save(); return true;
  }
  function inUse(id) {
    return S.pools.stoppage.includes(id) || S.pools.penalty.includes(id) || Object.values(S.goals).includes(id);
  }
  function removeFrom(where, id) {
    if (SLOTS[where]) S.goals[where] = null;
    else S.pools[where] = S.pools[where].filter((x) => x !== id);
    if (!inUse(id)) delete S.tracks[id];
    save(); renderLib();
  }

  function rowHTML(t, where) {
    return `<div class="item" data-id="${t.id}" data-where="${where}">
      <div class="t"><div>${esc(t.name)}</div><div class="a">${esc(t.artist)}</div></div>
      <input class="cue" value="${fmt(t.cueMs)}" inputmode="numbers-and-punctuation" aria-label="cue">
      <button data-act="preview">▶</button>
      <button data-act="remove">✕</button>
    </div>`;
  }
  function renderLib() {
    for (const pool of ["stoppage", "penalty"]) {
      const ids = S.pools[pool].filter((id) => S.tracks[id]);
      $("list-" + pool).innerHTML = ids.length ? ids.map((id) => rowHTML(S.tracks[id], pool)).join("")
        : `<p class="muted">Empty. Add songs under "+ Add songs".</p>`;
    }
    $("slots").innerHTML = Object.entries(SLOTS).map(([k, label]) => {
      const t = S.tracks[S.goals[k]];
      return `<h2>${esc(label)}</h2><div class="list">${t ? rowHTML(t, k) : `<p class="muted">Not set.</p>`}</div>`;
    }).join("");
    $("clientIdShow").textContent = "Client ID: " + (S.clientId || "none");
    $("fadeSelect").value = String(S.settings.fadeMs);
    $("wakeChk").checked = !!S.settings.wake;
  }

  function onLibClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const row = btn.closest(".item");
    const id = row.dataset.id, where = row.dataset.where;
    if (btn.dataset.act === "preview") playTrack(id, where);
    if (btn.dataset.act === "remove") removeFrom(where, id);
  }
  function onCueChange(e) {
    if (!e.target.classList.contains("cue")) return;
    const id = e.target.closest(".item").dataset.id;
    const ms = parseCue(e.target.value);
    if (ms == null) { toast("Type the cue like 1:05", true); e.target.value = fmt(S.tracks[id].cueMs); return; }
    S.tracks[id].cueMs = ms; save();
    document.querySelectorAll(`.item[data-id="${id}"] input.cue`).forEach((i) => (i.value = fmt(ms)));
    toast(`Cue set to ${fmt(ms)}.`);
  }

  // search
  let lastResults = [];
  async function search() {
    const q = $("searchInput").value.trim();
    if (!q) return;
    $("searchInput").blur();
    try {
      const j = await api("GET", "/search?type=track&limit=10&q=" + encodeURIComponent(q));
      const items = (j && j.tracks && j.tracks.items || []).filter(Boolean);
      const clean = items.filter((t) => !t.explicit);
      lastResults = clean;
      const hidden = items.length - clean.length;
      $("searchNote").textContent = hidden ? `${hidden} explicit result${hidden > 1 ? "s" : ""} hidden. Try adding "clean" to your search if the song you want is missing.` : "Explicit songs are hidden automatically.";
      $("searchResults").innerHTML = clean.length ? clean.map((t, i) => `<div class="item" data-i="${i}">
        <div class="t"><div>${esc(t.name)}</div><div class="a">${esc(t.artists.map((a) => a.name).join(", "))} · ${fmt(t.duration_ms)}</div></div>
        <div class="acts">
          <button data-add="stoppage">+ Stoppage</button><button data-add="penalty">+ Penalty</button>
          <select data-set aria-label="Set as button song"><option value="">Set as…</option>${Object.entries(SLOTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
        </div></div>`).join("") : `<p class="muted">No clean results.</p>`;
    } catch (e) { playError(e); }
  }
  function onResultClick(e) {
    const btn = e.target.closest("button[data-add]");
    if (!btn) return;
    const it = lastResults[+btn.closest(".item").dataset.i];
    const where = btn.dataset.add;
    if (addToPool(where, it)) toast(`Added "${it.name}" to ${where === "stoppage" ? "Stoppage" : "Penalty"}.`);
    renderLib();
  }
  function onResultSet(e) {
    const sel = e.target.closest("select[data-set]");
    if (!sel || !sel.value) return;
    const it = lastResults[+sel.closest(".item").dataset.i];
    addTrack(it); S.goals[sel.value] = it.id; save();
    toast(`"${it.name}" is now the ${SLOTS[sel.value]} song.`);
    sel.value = "";
    renderLib();
  }
  async function importPlaylist(pool) {
    const m = $("plInput").value.match(/playlist[/:]([A-Za-z0-9]+)/);
    if (!m) { toast("Paste a Spotify playlist link.", true); return; }
    let added = 0, skipped = 0;
    try {
      // Spotify renamed /tracks to /items for newer apps; try both.
      let url = null;
      for (const ep of ["items", "tracks"]) {
        try { await api("GET", `/playlists/${m[1]}/${ep}?limit=1`); url = `${API}/playlists/${m[1]}/${ep}?limit=50`; break; } catch (e) { if (ep === "tracks") throw e; }
      }
      while (url) {
        const j = await api("GET", url);
        for (const row of j.items || []) {
          const it = row.track || row.item;
          if (!it || it.type !== "track" || !it.id) continue;
          if (it.explicit) { skipped++; continue; }
          if (!S.pools[pool].includes(it.id)) { addTrack(it); S.pools[pool].push(it.id); added++; }
        }
        url = j.next;
      }
      save(); renderLib();
      toast(`Added ${added} songs.` + (skipped ? ` Skipped ${skipped} explicit.` : ""), false, 5000);
    } catch (e) {
      toast(e.status === 403 || e.status === 404 ? "Spotify won't share that playlist with this app. Use a playlist you created, or add songs by search." : e.message, true, 7000);
    }
  }

  // ---------- starter songs ----------
  async function seed(force) {
    if (!window.STARTER_SONGS) return;
    // First run: everything. Later runs: only button songs added since (e.g. warm-up / intermission).
    const list = (S.seeded && !force)
      ? window.STARTER_SONGS.filter((x) => SLOTS[x.role] && x.role !== "home" && x.role !== "away" && !S.goals[x.role] && !(S.slotsTried || []).includes(x.role))
      : window.STARTER_SONGS;
    if (!list.length) return;
    toast("Finding songs on Spotify…", false, 20000);
    let found = 0, missed = [];
    for (const s of list) {
      try {
        let j = await api("GET", "/search?type=track&limit=10&q=" + encodeURIComponent(`track:"${s.title}" artist:"${s.artist}"`));
        if (!(j && j.tracks && j.tracks.items && j.tracks.items.length))
          j = await api("GET", "/search?type=track&limit=10&q=" + encodeURIComponent(s.q || `${s.title} ${s.artist}`));
        const items = (j && j.tracks && j.tracks.items || []).filter(Boolean);
        const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
        const want = norm(s.title);
        const it = items.find((t) => !t.explicit && norm(t.name).startsWith(want) && !/live|remix|karaoke|instrumental/i.test(t.name))
          || items.find((t) => !t.explicit && norm(t.name).includes(want))
          || items.find((t) => !t.explicit);
        if (!it) { missed.push(s.title); continue; }
        const t = addTrack(it);
        if (!t.cueMs) t.cueMs = parseCue(s.cue) || 0;
        if (SLOTS[s.role]) { if (!S.goals[s.role] || force) S.goals[s.role] = it.id; }
        else if (!S.pools[s.role].includes(it.id)) S.pools[s.role].push(it.id);
        found++;
        await sleep(120); // be polite to the rate limit
      } catch (e) {
        if (e.status === 429) { await sleep(3000); }
        else missed.push(s.title);
      }
    }
    S.seeded = true;
    S.slotsTried = Object.keys(SLOTS);
    save(); renderLib();
    toast(`Loaded ${found} song${found === 1 ? "" : "s"}.` + (missed.length ? ` Couldn't find a clean version of: ${missed.join(", ")}.` : ""), false, 7000);
  }

  // ---------- settings ----------
  async function refreshDevices() {
    try {
      const list = await getDevices();
      const sel = $("deviceSelect");
      sel.innerHTML = `<option value="">Automatic (this phone)</option>` + list.map((d) => `<option value="${esc(d.id)}">${esc(d.name)} (${esc(d.type)}${d.supports_volume ? "" : ", no volume control"})</option>`).join("");
      sel.value = list.some((d) => d.id === S.settings.deviceId) ? S.settings.deviceId : "";
      if (!list.length) toast("No devices. Open the Spotify app, play a song for a second, then refresh.", true, 6000);
    } catch (e) { playError(e); }
  }
  async function testConnection() {
    const out = $("diagOut");
    out.classList.remove("hidden");
    out.textContent = "Checking…";
    const lines = [];
    try {
      const list = await getDevices();
      lines.push("Spotify devices I can see:");
      if (!list.length) lines.push("  (none — open the Spotify app on your phone and play something)");
      list.forEach((d) => lines.push(`  ${d.is_active ? "▶" : "•"} ${d.name} [${d.type}]${d.is_restricted ? " RESTRICTED" : ""}${d.supports_volume ? "" : " no-volume"}`));
      const p = await api("GET", "/me/player?additional_types=track");
      lines.push("", "Spotify right now:");
      lines.push(p ? `  ${p.is_playing ? "playing" : "paused"}: ${p.item ? p.item.name : "(no track)"} on ${p.device ? p.device.name : "?"}` : "  nothing active");
    } catch (e) { lines.push("Error talking to Spotify: " + e.message + (e.status ? " (" + e.status + ")" : "")); }
    if (lastProblem) lines.push("", "Last problem: " + JSON.stringify(lastProblem));
    out.textContent = lines.join("\n");
  }
  function backupText() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
  function restore(text) {
    try {
      const obj = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
      if (!obj || typeof obj.tracks !== "object") throw 0;
      S = Object.assign(blank(), obj); save();
      toast("Restored."); boot();
    } catch (e) { toast("That backup text didn't work. Copy it again and paste the whole thing.", true); }
  }

  // ---------- screen keep-awake ----------
  let wakeLock = null;
  async function wake() {
    if (!S.settings.wake || !("wakeLock" in navigator) || document.hidden) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
  }

  // ---------- navigation ----------
  function show(name) {
    for (const s of ["setup", "main", "lib"]) $(s).classList.toggle("hidden", s !== name);
    if (name === "lib") renderLib();
    window.scrollTo(0, 0);
  }
  function tab(name) {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + name));
    if (name === "settings") refreshDevices();
  }

  // ---------- wire up ----------
  function bind() {
    $("redirectShow").textContent = REDIRECT;
    $("loginBtn").onclick = login;
    $("setupRestore").onclick = (e) => { e.preventDefault(); $("setupRestoreBox").classList.toggle("hidden"); };
    $("setupRestoreBtn").onclick = () => restore($("setupRestoreText").value);

    $("playBtn").onclick = onPlay;
    $("homeBtn").onclick = () => onGoal("home");
    $("awayBtn").onclick = () => onGoal("away");
    document.querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => onGoal(b.dataset.slot)));
    $("penBtn").onclick = onPenalty;
    $("skipBtn").onclick = onSkip;
    $("replayBtn").onclick = onReplay;
    $("markBtn").onclick = markCue;
    $("openLib").onclick = () => show("lib");
    $("closeLib").onclick = () => { show("main"); poll(); };

    $("tabs").onclick = (e) => { const b = e.target.closest("button[data-tab]"); if (b) tab(b.dataset.tab); };
    for (const id of ["list-stoppage", "list-penalty", "slots"]) {
      $(id).addEventListener("click", onLibClick);
      $(id).addEventListener("change", onCueChange);
    }
    $("searchBtn").onclick = search;
    $("searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
    $("searchResults").addEventListener("click", onResultClick);
    $("searchResults").addEventListener("change", onResultSet);
    $("plStop").onclick = () => importPlaylist("stoppage");
    $("plPen").onclick = () => importPlaylist("penalty");

    $("deviceSelect").onchange = (e) => { S.settings.deviceId = e.target.value; device = null; save(); pickDevice().catch(() => {}); };
    $("refreshDevices").onclick = refreshDevices;
    $("diagBtn").onclick = testConnection;
    $("alert").onclick = clearAlert;
    $("fadeSelect").onchange = (e) => { S.settings.fadeMs = +e.target.value; save(); };
    $("wakeChk").onchange = (e) => { S.settings.wake = e.target.checked; save(); if (S.settings.wake) wake(); else if (wakeLock) wakeLock.release(); };
    $("backupBtn").onclick = async () => {
      const txt = backupText();
      try { await navigator.clipboard.writeText(txt); toast("Backup copied. Paste it somewhere safe (Notes works)."); }
      catch (e) { $("restoreText").value = txt; $("restoreText").select(); toast("Couldn't copy automatically. The text is in the box below; copy it from there."); }
    };
    $("restoreBtn").onclick = () => restore($("restoreText").value);
    $("reseedBtn").onclick = () => seed(true);
    $("logoutBtn").onclick = () => { S.tokens = null; save(); boot(); };
    $("resetBtn").onclick = () => { if (confirm("Erase all songs, cues and login from this phone?")) { localStorage.removeItem(KEY); S = blank(); boot(); } };

    document.addEventListener("visibilitychange", () => { if (!document.hidden) { wake(); device = null; poll(); } });
    setInterval(poll, 5000);
  }

  async function boot() {
    $("clientIdInput").value = S.clientId || "";
    if (!S.tokens) { show("setup"); return; }
    show("main");
    setPlayBtn();
    wake();
    pickDevice().catch(() => setStatus(true));
    poll();
    seed(false);
  }

  bind();
  handleRedirect().catch((e) => toast(e.message, true)).finally(boot);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
