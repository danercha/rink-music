# Rink Music — setup guide

A one-screen Spotify remote for the scorekeeper's table: a big **Play/Stop** button, **Home Goal**, **Away Goal** and **Penalty** buttons, and every song starts at the good part instead of the intro. It controls the Spotify app on your iPad or iPhone, so you need Spotify Premium (you have it) and Wi-Fi.

Setup takes about 10 minutes, once. You'll do three things: turn on the free GitHub Pages site, register the app with Spotify, then sign in on your phone. Do steps 1 and 2 on a computer; it's easier.

---

## Step 1: Turn on GitHub Pages (free)

The app files are already in https://github.com/danercha/rink-music.

1. In the repo, click **Settings** (top) → **Pages** (left side).
2. Under "Build and deployment", Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)** → **Save**.
3. Wait one or two minutes, then refresh. It shows your address: **`https://danercha.github.io/rink-music/`**. Open it; you should see the Rink Music setup screen.

## Step 2: Register the app with Spotify

1. Go to **https://developer.spotify.com/dashboard** and log in with your normal Spotify account. Accept the developer terms if asked.
2. Click **Create app** and fill in:
   - App name: `Rink Music`
   - App description: `Scorekeeper music remote`
   - Redirect URI: **`https://danercha.github.io/rink-music/`** → click **Add**. It must match exactly, including the `https` and the slash at the end. (The app's setup screen also shows this address so you can copy it.)
   - Under "Which API/SDKs are you planning to use?", tick **Web API**.
   - Tick the terms box and click **Save**.
3. On the app's page, click **Settings**. Copy the **Client ID** (a 32-character code). You don't need the Client Secret; the app never uses it.

## Step 3: Sign in on your iPhone

1. On your iPhone, open **Safari** and go to `https://danercha.github.io/rink-music/`.
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**. Open **Rink Music** from your home screen from now on.
3. Paste the Client ID, tap **Connect Spotify**, then **Agree**.
4. You land on the controller. It spends about 20 seconds finding the starter songs on Spotify

If you end up stuck on a Spotify or browser page after tapping Agree instead of back in the app: do the sign-in in plain Safari instead. In Safari, go to **Songs & settings → Settings → Copy backup**, then open the home-screen app, tap **Paste a backup** on its setup screen, paste and tap **Restore**. (Or just use it in Safari; it works the same.)

---

## Game day

1. **Open the Spotify app first and play any song for a second, then pause.** This wakes Spotify up so the remote can find your phone. Leave Spotify running in the background.
2. Open **Rink Music**. The top line should say *Playing on [your iPhone]* with a green dot.
3. Clock stops → **PLAY**. Clock starts → **STOP**. That's it.
   - **HOME GOAL / AWAY GOAL** play their fixed song from its cue.
   - **PENALTY** rotates through the penalty songs.
   - The small row (**Pre Game**, **Warm Up 1/2**, **Intermission 1/2**, **Post Game**) plays one fixed song each: The Foggy Dew, The Foggy Dew (change Warm Up 1 to whatever you like), For Whom the Bell Tolls, Immigrant Song, Cult of Personality and Can I Kick It?.
   - **Next song** skips to a different random song; **Restart at cue** replays the current one from its start point.
   - Songs don't repeat until the whole pool has played.

**Keeping Spotify awake.** iPads and iPhones put the Spotify app to sleep a few minutes after its music is paused, and a sleeping Spotify can't be controlled by this app. So when you press **STOP**, the app doesn't pause Spotify. It switches to a silent track on repeat. The rink hears nothing, Spotify stays awake, and the next button press works even after a long gap. The top card says "Standing by" while that's happening. You can turn this off or test the silent track under **Settings → Keep Spotify awake**.

If Spotify does fall asleep anyway (Low Power Mode, a phone call, or you swiped Spotify away), a red message with an **Open Spotify** button appears. Tap it, press play on anything in Spotify, then come back. The app checks every 30 seconds, so you usually find out before you need the music.

The screen stays awake while the app is open (newer iPhones). Turn that off in Settings if you prefer.

## Fixing where songs start (cues)

The starter cues are my best guesses, and Spotify sometimes picks a different recording, so expect to fix a few. Two ways:

- **Mark cue here:** play the song (▶ in the song list, or just in Spotify). When it hits the spot you want, tap **Mark cue here** on the main screen. Saved.
- **Type it:** in **Songs & settings**, each song has a box like `0:55`. Type a new time.

Doing a quick pass at home before the first game is worth it: go through the list with ▶ and mark cues.

## Changing songs

**Songs & settings → + Add songs.** Search for a song, then tap **+ Stoppage** or **+ Penalty**, or use **Set as…** to make it the song for Home goal, Away goal, Pre Game, a Warm Up, an Intermission or Post Game. Explicit songs show an **E** badge in search results so you can spot them.

You can also paste a link to one of your own Spotify playlists and add the whole thing. Remove songs with ✕.

## Back up your songs and cues

Everything is saved on your phone only. After you've set up cues, go to **Settings → Copy backup** and paste the text into a note. If you get a new phone or the app gets reset, paste it back with **Restore**. (The backup includes your Spotify login, so don't post it publicly.)

## Notes and limits

- **Stop pauses instead of fading on iPhone.** Spotify doesn't let other apps change the iPhone's volume remotely. The fade setting works if you play to a speaker that allows it (pick it under Settings → Speaker / device).
- There's a small delay (well under a second) between tap and music, because the command goes through Spotify's servers. Good Wi-Fi keeps it snappy.
- Your Spotify developer app is in "development mode", which is fine: it's just for you. If you ever want another scorekeeper to use your copy, add their Spotify email under **User Management** in the Spotify dashboard.

## Troubleshooting

| What you see | Fix |
|---|---|
| "INVALID_CLIENT: Invalid redirect URI" on the Spotify page | The Redirect URI in the Spotify dashboard doesn't match exactly. Copy it from the app's setup screen and add it again. |
| "Spotify isn't awake on your phone" | Open Spotify, play/pause once, come back. |
| Nothing happens when you tap | Check Wi-Fi. Then Settings → Refresh device list. |
| Wrong song or a live version | Remove it with ✕ and add the right version with search. |
| Signed out after a while | Tap Connect Spotify again; it takes two seconds. |

## Editing the starter list (optional)

`songs.js` holds the starter songs. You never need to edit it: adding and removing songs in the app is easier. If you do edit it on GitHub, use **Settings → Re-add the starter songs** in the app afterwards.

## Getting updates

The app checks for a new version every time you open it. If you ever still see an old version, go to **Songs & settings → Settings → Get the latest version**. Your songs, cues and login are kept. The version number is shown just under that button.
