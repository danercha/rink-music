// Starter songs. The app looks each one up on Spotify the first time you sign in,
// picks the best match, and sets the cue (where playback starts).
// Cues are starting guesses: fix any of them in the app with "Mark cue here".
// You can also just add/remove songs inside the app; you never have to edit this file.
//
// role: "stoppage" (random Play pool), "penalty" (rotating), or a one-song button:
//       "home", "away" (goals), "pre" (pre-game), "warm1", "warm2" (warm-up), "int1", "int2" (intermission)

window.STARTER_SONGS = [
  // Goal songs (one each)
  { role: "home",     title: "Song 2",                       artist: "Blur",               cue: "0:00" },
  { role: "away",     title: "Celebration",                  artist: "Kool & The Gang",    cue: "0:22" },

  // Pre-game, warm-up and intermission buttons (one each)
  { role: "pre",      title: "The Foggy Dew",                artist: "The Chieftains",     cue: "0:00", q: "Foggy Dew Chieftains Sinead O'Connor" },
  { role: "warm1",    title: "The Foggy Dew",                artist: "The Chieftains",     cue: "0:00", q: "Foggy Dew Chieftains Sinead O'Connor" },
  { role: "warm2",    title: "For Whom the Bell Tolls",      artist: "Metallica",          cue: "0:00" },
  { role: "int1",     title: "Immigrant Song",               artist: "Led Zeppelin",       cue: "0:00" },
  { role: "int2",     title: "Cult of Personality",          artist: "Living Colour",      cue: "0:00" },

  // Penalty songs (rotate)
  { role: "penalty",  title: "Bad to the Bone",              artist: "George Thorogood",   cue: "0:00" },
  { role: "penalty",  title: "Bad Boys",                     artist: "Inner Circle",       cue: "0:00" },
  { role: "penalty",  title: "Hit the Road Jack",            artist: "Ray Charles",        cue: "0:00" },
  { role: "penalty",  title: "Breaking the Law",             artist: "Judas Priest",       cue: "0:00" },
  { role: "penalty",  title: "I Fought the Law",             artist: "The Clash",          cue: "0:00" },
  { role: "penalty",  title: "Jailhouse Rock",               artist: "Elvis Presley",      cue: "0:00" },

  // Stoppage pool (random)
  { role: "stoppage", title: "Seven Nation Army",            artist: "The White Stripes",  cue: "0:00" },
  { role: "stoppage", title: "Thunderstruck",                artist: "AC/DC",              cue: "0:58" },
  { role: "stoppage", title: "Enter Sandman",                artist: "Metallica",          cue: "0:55" },
  { role: "stoppage", title: "Crazy Train",                  artist: "Ozzy Osbourne",      cue: "0:04" },
  { role: "stoppage", title: "Welcome to the Jungle",        artist: "Guns N' Roses",      cue: "0:20" },
  { role: "stoppage", title: "We Will Rock You",             artist: "Queen",              cue: "0:00" },
  { role: "stoppage", title: "Eye of the Tiger",             artist: "Survivor",           cue: "0:00" },
  { role: "stoppage", title: "Kernkraft 400",                artist: "Zombie Nation",      cue: "0:15" },
  { role: "stoppage", title: "Sandstorm",                    artist: "Darude",             cue: "0:15" },
  { role: "stoppage", title: "Mr. Brightside",               artist: "The Killers",        cue: "0:00" },
  { role: "stoppage", title: "Uptown Funk",                  artist: "Mark Ronson",        cue: "0:00" },
  { role: "stoppage", title: "Can't Hold Us",                artist: "Macklemore",         cue: "0:00" },
  { role: "stoppage", title: "Party Rock Anthem",            artist: "LMFAO",              cue: "0:22" },
  { role: "stoppage", title: "I Gotta Feeling",              artist: "Black Eyed Peas",    cue: "0:16" },
  { role: "stoppage", title: "Shout",                        artist: "Otis Day and the Knights", cue: "0:00" },
  { role: "stoppage", title: "Don't Stop Me Now",            artist: "Queen",              cue: "0:35" },
  { role: "stoppage", title: "Livin' on a Prayer",           artist: "Bon Jovi",           cue: "0:00" },
  { role: "stoppage", title: "You Shook Me All Night Long",  artist: "AC/DC",              cue: "0:00" },
  { role: "stoppage", title: "Centuries",                    artist: "Fall Out Boy",       cue: "0:00" },
  { role: "stoppage", title: "Believer",                     artist: "Imagine Dragons",    cue: "0:00" },
  { role: "stoppage", title: "Thunder",                      artist: "Imagine Dragons",    cue: "0:00" },
  { role: "stoppage", title: "Sweet Caroline",               artist: "Neil Diamond",       cue: "1:57" },
  { role: "stoppage", title: "Let's Get It Started",         artist: "Black Eyed Peas",    cue: "0:00" },
  { role: "stoppage", title: "Jump",                         artist: "Van Halen",          cue: "0:00" },
  { role: "stoppage", title: "Blitzkrieg Bop",               artist: "Ramones",            cue: "0:00" },
  { role: "stoppage", title: "Cotton Eye Joe",               artist: "Rednex",             cue: "0:00" },
  { role: "stoppage", title: "Shut Up and Dance",            artist: "WALK THE MOON",      cue: "0:00" },
  { role: "stoppage", title: "Hey Ya!",                      artist: "OutKast",            cue: "0:00" },
  { role: "stoppage", title: "Tubthumping",                  artist: "Chumbawamba",        cue: "0:00" },
  { role: "stoppage", title: "Can't Stop the Feeling!",      artist: "Justin Timberlake",  cue: "0:00" },
  { role: "stoppage", title: "Pump It",                      artist: "Black Eyed Peas",    cue: "0:00" },
  { role: "stoppage", title: "Gonna Fly Now",                artist: "Bill Conti",         cue: "0:00" },
  { role: "stoppage", title: "Rock You Like a Hurricane",    artist: "Scorpions",          cue: "0:00" },
  { role: "stoppage", title: "Shipping Up to Boston",        artist: "Dropkick Murphys",   cue: "0:00" },
];
