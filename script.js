(() => {
  // ========= CONFIG =========
  const DEV_MODE = false; // Show country codes on tiles for testing
  const STREET_VIEW_API_KEY = "AIzaSyAb2IZiueqc9Io7GSYAp2hy6nvvUL_WdJw"; // your key
  
  // Export for use in tileModal.js
  window.STREET_VIEW_API_KEY = STREET_VIEW_API_KEY;
  const REQUIRE_COUNTRY_GUESS = true;
  const MAX_MISTAKES = 4;
  // ==== MODE (normal / expert) ====
const MODE_KEY = "geonections_mode";
let currentMode = localStorage.getItem(MODE_KEY) || "normal";
function isExpertMode() { return currentMode === "expert"; }
function setMode(m) {
  currentMode = m;
  localStorage.setItem(MODE_KEY, m);
  document.documentElement.dataset.mode = m; // for CSS
}

// Mistake budget: 4 normal, 2 expert
const MAX_MISTAKES_NORMAL = 4;
const MAX_MISTAKES_EXPERT = 2;
function getMaxMistakes() {
  return isExpertMode() ? MAX_MISTAKES_EXPERT : MAX_MISTAKES_NORMAL;
}
  // Use Static Street View in fullscreen? (false = pano mode, locked POV)
  const USE_STATIC_IN_VIEWER = false;
  const DIFF_COLORS = { Easy: "#FACC15", Medium: "#14B8A6", Hard: "#A855F7", Expert: "#EF4444" };
  const DIFF_EMOJI  = { Easy: "🟨", Medium: "🟦", Hard: "🟪", Expert: "🟥" };
  const TAG_ORDER   = ["Easy", "Medium", "Hard", "Expert"];
    // ========= DAILY PUZZLE (UTC) =========
  // Set this to the date when "Geonections #1" should go live (00:00 UTC that day).
  // Months are 0-based (7 = August). Example below uses Aug 26, 2025.
  const LAUNCH_UTC = Date.UTC(2025, 8, 5);
  // ========= DAILY CHALLENGES (rotate at 00:00 UTC) =========
const CHALLENGES = [
  { name: "Fun Facts! 🤯", url: "https://www.geoguessr.com/challenge/HTspBAzQLf8BEid4" },
  { name: "Red and Orange 💥", url: "https://www.geoguessr.com/challenge/prF37wfbCzMw99p1" },
  { name: "Yellow and Green 🌻", url: "https://www.geoguessr.com/challenge/CZ94e2921BpthgUX" },
  { name: "FOG ☁️", url: "https://www.geoguessr.com/challenge/5nvMggX9L9Eg4NnY" },
  { name: "Animals 🦊", url: "https://www.geoguessr.com/challenge/p9sbsJGzihQX64wB" },
  { name: "Random Interesting Metas 🌎", url: "https://www.geoguessr.com/challenge/4H7K3wfqzIovZY90" },
  { name: "Region guessing the US with Plants 🌿", url: "https://www.geoguessr.com/challenge/YWA8ZXmYqssztj2L" },
  { name: "Cool Trees 🤩", url: "https://www.geoguessr.com/challenge/Efz0sIktnzDZbWIj" },
  { name: "Plants to help u tell SA from SEA 🌴", url: "https://www.geoguessr.com/challenge/RQ8W5Srg6yIf9lb8" },
  { name: "Deciduous Trees of Scandinavia 🍁", url: "https://www.geoguessr.com/challenge/uQ885ktRN90xVvdj" },
  { name: "Oklahoma or Brazil 🧐", url: "https://www.geoguessr.com/challenge/cn2u7PAuVapNjBSK" },
  { name: "Niche European Architecture 🏡", url: "https://www.geoguessr.com/challenge/TI8GsSocJh0GnaZh" },
  { name: "Lovely Locs ⛅️", url: "https://www.geoguessr.com/challenge/CKHnHvI4PN1WE2Pr" },
  { name: "Album Covers 🖼️", url: "https://www.geoguessr.com/challenge/PZGEvTMB99qqmwK6" }
];

// Start the rotation the same day your puzzles start
const CHALLENGE_START_UTC = LAUNCH_UTC;

function todayChallenge() {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let dayIndex = Math.floor((todayUTC - CHALLENGE_START_UTC) / 86400000);
  if (dayIndex < 0) dayIndex = 0; // before start date → show the first one
  const idx = dayIndex % CHALLENGES.length;
  return CHALLENGES[idx];
}


  function todayPuzzleNumberUTC() {
    const now = new Date();
    // Midnight UTC for "today"
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    // Days since launch, floor to whole days
    const days = Math.floor((todayUTC - LAUNCH_UTC) / 86400000);
    // Clamp to 1+
    return Math.max(1, days + 1);
  }

  function resolvePuzzleNumberFromURLOrUTC() {
    const params = new URLSearchParams(location.search);
    const p = params.get("puzzle");
    const n = p ? parseInt(p, 10) : NaN;
    if (!Number.isNaN(n) && n > 0) return n; // explicit override
    return todayPuzzleNumberUTC();            // daily default at 00:00 UTC
  }


  // ========= SELECTION BUCKETS (4 buckets x 4 items) =========
  function makeBuckets(capacity = 4, groups = 4) {
    const buckets = Array.from({ length: groups }, () => new Set());
    const index   = new Map(); // id -> bucketIdx

    const locate     = (id) => (index.has(id) ? index.get(id) : -1);
    let firstOpen    = () => buckets.findIndex(s => s.size < capacity);

function add(id) {
// Normal: cap at 4 selected at once. Expert: allow up to all 16.
const totalSelected = index.size;
if (!isExpertMode() && totalSelected >= 4) {
  return { ok: false, reason: 'max_selection' };
}

  const i = firstOpen();

      if (i === -1) return { ok: false, reason: 'full' }; // all 16 filled
      buckets[i].add(id);
      index.set(id, i);
      return { ok: true, action: 'add', bucket: i };
    }
    function remove(id) {
      const i = locate(id);
      if (i === -1) return { ok: false, reason: 'absent' };
      buckets[i].delete(id);
      index.delete(id);
      return { ok: true, action: 'remove', bucket: i };
    }
    function toggle(id, isLocked = false) { 
      if (isLocked) return { ok: false, reason: 'locked' };
      return index.has(id) ? remove(id) : add(id); 
    }
    function clearBucket(i) { for (const id of buckets[i]) index.delete(id); buckets[i].clear(); }
    function clearAll() { index.clear(); buckets.forEach(s => s.clear()); }
    function entries() { return buckets.map(s => [...s]); }
    function firstFullIdx() { return buckets.findIndex(s => s.size === capacity); }
    function hasExactlyFour() { return index.size === 4; }

    return {
      buckets, index, capacity, groups,
      locate, firstOpen, firstFullIdx, hasExactlyFour,
      add, remove, toggle, clearBucket, clearAll, entries,
      updateFirstOpen: (newFirstOpen) => { firstOpen = newFirstOpen; }
    };
  }

  // ========= STATE =========
  let allData = [];
  let boardTiles = [];
  const selections = makeBuckets(4, 4);
let mistakesLeft = getMaxMistakes();
  let currentTile = null;
  let lastClickedTile = null;
  let tagStep = 0;
  const tagCounts = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
  // Track which JSON file was loaded (for debug display)
  let loadedSource = "";
  // Guess history for share text (rows of emoji)
let shareAttempts = [];
  // Buffer of 4 proposed groups when in Expert mode
let expertBuffer = [];

  // ========= DOM (ensure essential elements exist) =========
  const $ = (s) => document.querySelector(s);
  function ensure(selector, html, insertAfterSelector) {
    let el = document.querySelector(selector);
    if (!el) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html.trim();
      el = tmp.firstElementChild;
      const anchor = insertAfterSelector ? document.querySelector(insertAfterSelector) : null;
      if (anchor) {
        anchor.insertAdjacentElement("afterend", el);
      } else {
        (document.body || document.documentElement).appendChild(el);
      }
    }
    return el;
  }

  const messageEl = ensure("#message",
    `<div id="message" class="messages" aria-live="polite"></div>`,
    ".controls"
  );
  const boardEl = ensure("#board",
    `<div id="board" class="board" aria-label="Puzzle board"></div>`,
    "#message"
  );
  const solvedEl = ensure("#solved",
    `<div id="solved"></div>`,
    "#board"
  );

  const groupsRemainingEl = $("#groups-remaining");
  const mistakesLeftEl    = $("#mistakes-left");
  const submitBtn   = $("#submit-btn");
  const deselectBtn = $("#deselect-btn");
  const shuffleBtn  = $("#shuffle-btn");
  const shareBtn    = $("#share-btn");


  const guessFeedback = $("#guess-feedback");
  const suggestions   = $("#country-suggestions");
  const infoModal     = $("#info-modal");
  const infoClose     = $("#info-close");

  // Wire expert toggle in the welcome card
const expertToggle = document.getElementById("expert-toggle");
if (expertToggle) {
  // reflect stored mode at load
  document.documentElement.dataset.mode = currentMode;
  expertToggle.checked = isExpertMode();
  expertToggle.addEventListener("change", () => {
    setMode(expertToggle.checked ? "expert" : "normal");
    mistakesLeft = getMaxMistakes();
    if (mistakesLeftEl) mistakesLeftEl.textContent = `Mistakes: ${mistakesLeft}`;
    // fresh run so rules apply immediately
    startNewGame();
    // ensure the one blind tile is applied (see 3d)
    applyExpertBlindTile();
  });
}

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Tiny debug status line (shows parse/build counts and loaded file name)
  const debugBar = document.createElement("div");
  debugBar.style.cssText = "margin:.25rem 0; color:#9aa3b2; font-size:.85rem";
  if (messageEl?.parentElement) {
    messageEl.parentElement.insertBefore(debugBar, messageEl);
  }

  // ========= INIT =========
  init();
  async function init() {
    showMessage("");  // clear any stale messages
    try {

const puzzle = String(resolvePuzzleNumberFromURLOrUTC());
      // Try multiple filename patterns (to handle spaces, encoding, etc.)
      const candidates = [
        // `./Geonections%20%23${puzzle}.json`,     // e.g., "Geonections #1.json" (with encoded '#')
        // `./Geonections%2520%2523${puzzle}.json`, // double-encoded edge case
        // `./Geonections%20${puzzle}.json`,        // "Geonections 1.json"
        `./Geonections_${puzzle}.json`,          // "Geonections_1.json"
        // `./Geonections-${puzzle}.json`,          // "Geonections-1.json"
        // `./Geonections.json`,                    // fallback to generic name
        // `./geonections.json`,
        // `/Geonections.json`
      ];
      const { json, used } = await tryFetchJSON(candidates);
      loadedSource = used;
      allData = normalizeGeonections(json);
      startNewGame();
      applyExpertBlindTile();
      // Hide any error message after successful load
      showMessage("");
      // Show info modal once per session (if present in DOM)
      if (infoModal && !sessionStorage.getItem("infoShown")) {
        infoModal.classList.remove("hidden");
        sessionStorage.setItem("infoShown", "1");
      }
    } catch (err) {
      // If nothing rendered yet, show an error message
      if (!boardTiles.length) {
        showMessage("Could not load a Geonections JSON. Put it next to index.html. Tip: avoid '#' in filenames or use ?puzzle=1.", true);
      }
      console.error(err);
    }
  }

  async function tryFetchJSON(paths) {
    let lastError;
    for (const p of paths) {
      try {
        const url = new URL(p, location.href).toString();
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) {
          const json = await r.json();
          return { json, used: p };
        }
        lastError = new Error(`HTTP ${r.status} @ ${p}`);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("JSON not found");
  }

  // ========= EVENT LISTENERS =========
submitBtn?.addEventListener("click", () => {
  if (isExpertMode()) onSubmitGroupExpert();
  else onSubmitGroup();
});
  deselectBtn?.addEventListener("click", clearSelection);
  shuffleBtn?.addEventListener("click", () => {
    // Shuffle only unsolved tiles, keep solved ones in their exact positions
    const unsolvedIndices = [];
    const unsolvedTiles = [];
    
    // Find all unsolved tile indices and collect the tiles
    boardTiles.forEach((tile, index) => {
      if (!tile.locked) {
        unsolvedIndices.push(index);
        unsolvedTiles.push(tile);
      }
    });
    
    console.log(`Shuffling ${unsolvedTiles.length} unsolved tiles out of ${boardTiles.length} total tiles`);
    
    // Shuffle only the unsolved tiles
    shuffle(unsolvedTiles);
    
    // Place shuffled unsolved tiles back into any available unsolved positions
    let unsolvedIndex = 0;
    boardTiles.forEach((tile, i) => {
      if (!tile.locked) {
        boardTiles[i] = unsolvedTiles[unsolvedIndex];
        unsolvedIndex++;
      }
    });
    
    // Move DOM elements without re-rendering
    shuffleBoardDOM();
    showMessage("");
  });
  shareBtn?.addEventListener("click", onShare);
                const pastBtn     = $("#past-btn");

    pastBtn?.addEventListener("click", () => {
    const max = todayPuzzleNumberUTC(); // only allow up to "today"
    const input = prompt(`Enter puzzle number (1–${max}):`);
    const num = input ? parseInt(input, 10) : NaN;
    if (!Number.isNaN(num) && num >= 1 && num <= max) {
      const sp = new URLSearchParams(location.search);
      sp.set("puzzle", String(num));
      // This reloads the page with the chosen puzzle
      location.search = sp.toString();
    }
  });



  infoClose?.addEventListener("click", () => infoModal?.classList.add("hidden"));
  infoModal?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      infoModal.classList.add("hidden");
    }
  });
  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    // Only handle keys when not in an input field
    if (document.activeElement && /^(input|textarea)$/i.test(document.activeElement.tagName)) {
      return;
    }
    
    // Press 'F' key to open Street View fullscreen on the last clicked tile
    if (e.key === "f" || e.key === "F") {
      if (lastClickedTile && tileModal?.classList.contains("hidden")) {
        openTileModal(lastClickedTile);
      }
    }
    
    // Press 'Enter' key to submit the current group selection
 if (e.key === "Enter") {
  if (isExpertMode()) {
    onSubmitGroupExpert();
  } else if (selections.firstFullIdx() !== -1) {
    onSubmitGroup();
  }
}
  });

  // ========= DATA NORMALIZATION =========
  const ISO2_NAME = {
    AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra", AO: "Angola", AG: "Antigua and Barbuda",
    AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BS: "Bahamas", BH: "Bahrain",
    BD: "Bangladesh", BB: "Barbados", BY: "Belarus", BE: "Belgium", BZ: "Belize", BJ: "Benin", BT: "Bhutan", BO: "Bolivia",
    BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil", BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi",
    CV: "Cabo Verde", KH: "Cambodia", CM: "Cameroon", CA: "Canada", CF: "Central African Republic", TD: "Chad", CL: "Chile",
    CN: "China", CO: "Colombia", KM: "Comoros", CG: "Congo", CD: "Democratic Republic of the Congo", CR: "Costa Rica",
    CI: "Côte d'Ivoire", HR: "Croatia", CU: "Cuba", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", DJ: "Djibouti", DM: "Dominica",
    DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt", SV: "El Salvador", GQ: "Equatorial Guinea", ER: "Eritrea",
    EE: "Estonia", SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France", GA: "Gabon", GM: "Gambia",
    GE: "Georgia", DE: "Germany", GH: "Ghana", GR: "Greece", GD: "Grenada", GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau",
    GY: "Guyana", HT: "Haiti", HN: "Honduras", HU: "Hungary", IS: "Iceland", IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq",
    IE: "Ireland", IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan", KZ: "Kazakhstan", KE: "Kenya",
    KI: "Kiribati", KP: "North Korea", KR: "South Korea", KW: "Kuwait", KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia",
    LB: "Lebanon", LS: "Lesotho", LR: "Liberia", LY: "Libya", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg",
    MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives", ML: "Mali", MT: "Malta", MH: "Marshall Islands",
    MR: "Mauritania", MU: "Mauritius", MX: "Mexico", FM: "Micronesia", MD: "Moldova", MC: "Monaco", MN: "Mongolia",
    ME: "Montenegro", MA: "Morocco", MZ: "Mozambique", MM: "Myanmar", NA: "Namibia", NR: "Nauru", NP: "Nepal", NL: "Netherlands",
    NZ: "New Zealand", NI: "Nicaragua", NE: "Niger", NG: "Nigeria", MK: "North Macedonia", NO: "Norway", OM: "Oman", PK: "Pakistan",
    PW: "Palau", PS: "Palestine", PA: "Panama", PG: "Papua New Guinea", PY: "Paraguay", PE: "Peru", PH: "Philippines", PL: "Poland",
    PT: "Portugal", QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda", KN: "Saint Kitts and Nevis", LC: "Saint Lucia",
    VC: "Saint Vincent and the Grenadines", WS: "Samoa", SM: "San Marino", ST: "Sao Tome and Principe", SA: "Saudi Arabia",
    SN: "Senegal", RS: "Serbia", SC: "Seychelles", SL: "Sierra Leone", SG: "Singapore", SK: "Slovakia", SI: "Slovenia",
    SB: "Solomon Islands", SO: "Somalia", ZA: "South Africa", SS: "South Sudan", ES: "Spain", LK: "Sri Lanka", SD: "Sudan",
    SR: "Suriname", SE: "Sweden", CH: "Switzerland", SY: "Syria", TW: "Taiwan", TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand",
    TL: "Timor-Leste", TG: "Togo", TO: "Tonga", TT: "Trinidad and Tobago", TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan",
    TV: "Tuvalu", UG: "Uganda", UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
    UY: "Uruguay", UZ: "Uzbekistan", VU: "Vanuatu", VA: "Vatican City", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
    ZM: "Zambia", ZW: "Zimbabwe", XK: "Kosovo"
  };
  const EXTRA_ALIASES = {
    "United States": ["USA", "US", "U.S.", "U.S.A.", "America", "United States of America"],
    "United Kingdom": ["UK", "U.K.", "Britain", "Great Britain"],
    "Czechia": ["Czech Republic"], "Côte d'Ivoire": ["Ivory Coast", "Cote d'Ivoire", "Cote dIvoire", "Côte dIvoire"],
    "Cabo Verde": ["Cape Verde"], "Eswatini": ["Swaziland"], "Laos": ["Lao PDR", "Lao People's Democratic Republic", "Lao Peoples Democratic Republic"],
    "Myanmar": ["Burma"], "North Korea": ["DPRK", "Korea, North", "Democratic People's Republic of Korea"],
    "South Korea": ["ROK", "Korea, South", "Republic of Korea"], "Russia": ["Russian Federation"],
    "Sao Tome and Principe": ["São Tomé and Príncipe", "Sao Tome", "São Tomé"], "Timor-Leste": ["East Timor"],
    "Turkey": ["Türkiye", "Turkiye"], "Vatican City": ["Holy See", "Vatican"], "Micronesia": ["Federated States of Micronesia"],
    "Palestine": ["State of Palestine"], "Democratic Republic of the Congo": ["DR Congo", "DRC", "Congo-Kinshasa"],
    "Congo": ["Republic of the Congo", "Congo-Brazzaville"]
  };
  const CODE_TO_NAME = new Map(Object.entries(ISO2_NAME));
  const NAME_TO_CODE = new Map();
  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim()
      .replace(/[\.\,']/g, "").replace(/\s+/g, " ");
  }
  function addName(code, name) {
    NAME_TO_CODE.set(norm(name), code);
  }
  for (const [c, n] of Object.entries(ISO2_NAME)) addName(c, n);
  for (const [base, list] of Object.entries(EXTRA_ALIASES)) {
    const code = NAME_TO_CODE.get(norm(base));
    if (code) list.forEach(alias => addName(code, alias));
  }
  Object.keys(ISO2_NAME).forEach(c => addName(c, c));
  function nameOrCodeToCode(input) {
    const s = String(input || "").trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
    return NAME_TO_CODE.get(norm(s)) || "";
  }
  function canonicalCountry(input) {
    const code = nameOrCodeToCode(input);
    if (code && CODE_TO_NAME.has(code)) return CODE_TO_NAME.get(code);
    const s = String(input || "").trim();
    return s ? s[0].toUpperCase() + s.slice(1) : "";
  }
  function guessDifficulty(obj, tags) {
    const d1 = (obj?.difficulty || obj?.extra?.difficulty || "").toString().toLowerCase();
    const fromField = ["easy", "medium", "hard", "expert"].find(x => d1.includes(x));
    if (fromField) return capitalize(fromField);
    for (const t of tags) {
      const s = String(t || "").toLowerCase();
      if (s === "easy" || s === "medium" || s === "hard" || s === "expert") {
        return capitalize(s);
      }
    }
    return "Easy";
  }
  function normalizeGeonections(json) {
    const arr = Array.isArray(json?.customCoordinates) ? json.customCoordinates : [];
    const out = [];
    for (const raw of arr) {
      const lat = Number(raw.lat) || 0;
      const lng = Number(raw.lng) || 0;
      const heading = isFinite(+raw.heading) ? +raw.heading : 0;
      const pitch   = isFinite(+raw.pitch) ? +raw.pitch : 0;
      const panoId  = raw?.extra?.panoId || raw.panoId || null;
      const tags = Array.isArray(raw?.extra?.tags) ? raw.extra.tags : [];
      let countryRaw = raw?.country || raw?.extra?.country || "";
      if (!countryRaw) {
        for (const t of tags) {
          const s = String(t || "").trim();
          if (!s) continue;
          const low = s.toLowerCase();
          if (low === "easy" || low === "medium" || low === "hard" || low === "expert") continue;
          const code = nameOrCodeToCode(s);
          if (code || s.length > 1) {
            countryRaw = s;
            break;
          }
        }
      }
      const country = canonicalCountry(countryRaw);
      if (!country) continue;
      const difficulty = guessDifficulty(raw, tags);
      const id = (raw.id || (panoId ? `pano_${panoId}` : `pt_${lat}_${lng}_${heading}`)).replace(/\W+/g, "_");
      out.push({
        id, lat, lng, heading, pitch, panoId,
        country, difficulty,
        url: buildStreetViewURL({ panoId, lat, lng, heading, pitch })
      });
    }
    return out;
  }

  // ========= STREET VIEW STATIC URLS =========
  function buildStreetViewURL({ panoId, lat, lng, heading = 0, pitch = 0 }, opts = {}) {
    const fov   = opts.fov ?? 110;
    const scale = 2;
    const w     = opts.w ?? 640;
    const h     = opts.h ?? 640;
    if (STREET_VIEW_API_KEY) {
      const base = "https://maps.googleapis.com/maps/api/streetview";
      const sizeParams = `size=${w}x${h}&scale=${scale}&fov=${fov}&heading=${heading}&pitch=${pitch}&key=${encodeURIComponent(STREET_VIEW_API_KEY)}`;
      return panoId
        ? `${base}?pano=${encodeURIComponent(panoId)}&${sizeParams}`
        : `${base}?location=${lat},${lng}&${sizeParams}`;
    }
    if (panoId) {
      const base = "https://streetviewpixels-pa.googleapis.com/v1/thumbnail";
      return `${base}?cb_client=maps_sv.tactile&size=${w * scale}x${h * scale}&panoid=${encodeURIComponent(panoId)}&yaw=${heading}&pitch=${pitch}`;
    }
    return null;
  }

  function computeBestBaseSize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const vw  = Math.max(1, window.innerWidth  || 800);
    const vh  = Math.max(1, window.innerHeight || 600);
    return {
      baseW: Math.min(640, Math.floor(vw * dpr / 2)),
      baseH: Math.min(640, Math.floor(vh * dpr / 2))
    };
  }

  // ========= GAME FLOW =========
  function startNewGame() {
    shareAttempts = [];
    selections.clearAll();
mistakesLeft = getMaxMistakes();
    tagStep = 0;
    tagCounts.Easy = tagCounts.Medium = tagCounts.Hard = tagCounts.Expert = 0;
    gameActuallySolved = false;
    const puzzle = buildPuzzle16(allData);
    if (!puzzle.ok) {
      boardEl.innerHTML = "";
      solvedEl.innerHTML = "";
      updateStatus();
      showMessage(puzzle.error || "Not enough valid items to build a 4x4 board.", true);
      return;
    }
    boardTiles = shuffle(puzzle.tiles).map(t => ({ ...t, locked: !!t.locked }));
    solvedEl.innerHTML = "";
    initialRenderBoard();
    updateStatus();
  }

  function buildPuzzle16(data) {
    const valid = (data || []).filter(t => t && t.country && t.difficulty && t.id);
    if (valid.length === 16) {
      // Exactly 16 valid tiles provided, use them directly
      // console.log("puzzle A", valid);
      return { ok: true, tiles: valid.map(t => ({ ...t, locked: false })) };
    }
    const difficulties = ["Easy", "Medium", "Hard", "Expert"];
    const byDiff = new Map(difficulties.map(d => [d, new Map()]));
    for (const it of valid) {
      const d = difficulties.includes(it.difficulty) ? it.difficulty : "Easy";
      if (!byDiff.has(d)) continue;
      const m = byDiff.get(d);
      if (!m.has(it.country)) m.set(it.country, []);
      m.get(it.country).push(it);
    }
    const candidates = {};
    for (const d of difficulties) {
      candidates[d] = [...byDiff.get(d).entries()].filter(([, arr]) => arr.length >= 4);
    }
    const haveAll = difficulties.every(d => candidates[d].length > 0);
    if (haveAll) {
      const used = new Set();
      const chosen = {};
      for (const d of difficulties) {
        const opts = shuffle([...candidates[d]]);
        let pick = opts.find(([c]) => !used.has(c)) || opts[0];
        chosen[d] = pick;
        used.add(pick[0]);
      }
      const tiles = [];
      for (const d of difficulties) {
        const [, arr] = chosen[d];
        tiles.push(...sampleN(arr, 4).map(x => ({ ...x, locked: false })));
      }
      if (tiles.length === 16) {
        // console.log("puzzle B", tiles);
        return { ok: true, tiles };
      }
    }
    // Fallback: take any 4 countries that have >=4 locations each
    const byCountry = new Map();
    for (const it of valid) {
      if (!byCountry.has(it.country)) byCountry.set(it.country, []);
      byCountry.get(it.country).push(it);
    }
    const countryQuads = [...byCountry.entries()].filter(([, arr]) => arr.length >= 4);
    if (countryQuads.length >= 4) {
      shuffle(countryQuads);
      const chosen = countryQuads.slice(0, 4);
      const tiles = chosen.flatMap(([, arr]) => sampleN(arr, 4)).slice(0, 16).map(x => ({ ...x, locked: false }));
      if (tiles.length === 16) {
        // console.log("puzzle C", tiles);
        return { ok: true, tiles };
      }
    }
    // Final fallback: just take the first 16 valid locations
    const fallback = valid.slice(0, 16).map(t => ({ ...t, locked: false }));
    if (fallback.length === 16) {
      console.warn("[Geonections] Using final fallback — check your JSON tags (country/difficulty).");
      return { ok: true, tiles: fallback };
    }
    return { ok: false, error: "Not enough valid items to build a 4x4 board. Check JSON tags for country/difficulty." };
  }

  // ========= RENDER =========
  // ===== cache dom nodes =====
  const tileEls = new Map(); // id -> HTMLElement

  function initialRenderBoard() {
    boardEl.innerHTML = "";
    tileEls.clear();

    for (const tile of boardTiles) {
      const tileEl = document.createElement("div");
      tileEl.className = "tile";
      tileEl.dataset.id = tile.id;

      // locked state
      if (tile.locked) tileEl.classList.add("locked");

      // image (don't recreate later; avoids layout thrash + decode)
      if (tile.url) {
        const img = document.createElement("img");
        img.src = tile.url;
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        tileEl.appendChild(img);
        
        // Show country code overlay in dev mode or when tile is solved
        if (DEV_MODE || tile.locked) {
          const countryCode = document.createElement("div");
          countryCode.className = "dev-country-code";
          countryCode.textContent = tile.country;
          tileEl.appendChild(countryCode);
        }
      } else {
        const ph = document.createElement("div");
        ph.className = "noimg";
        ph.textContent = "No Image";
        tileEl.appendChild(ph);
      }

      // ring
      applyRing(tileEl, tile);

      // interactions
      tileEl.addEventListener("dblclick", () => { lastClickedTile = tile; openTileModal(tile); });
      tileEl.addEventListener("mousedown", () => {
        lastClickedTile = tile;
        if (tile.locked) return;
        
        // Check if this tile belongs to an already solved category
        const solvedCategories = getSolvedCategories();
        if (solvedCategories.has(tile.difficulty)) {
          showMessage(`The ${tile.difficulty} category is already solved!`, true);
          return;
        }
        
        const res = selections.toggle(tile.id, tile.locked);
        if (!res.ok) {
          if (res.reason === 'full') {
            showMessage("All groups are full!", true);
          } else if (res.reason === 'locked') {
            showMessage("This tile is already solved!", true);
          } else if (res.reason === 'max_selection') {
            showMessage("You can only select 4 tiles at a time!", true);
          }
        }
        updateSelectionUI();
      });

      boardEl.appendChild(tileEl);
      tileEls.set(tile.id, tileEl);
    }

    updateSelectionUI();
updateSubmitDisabled();
  }

  // Legacy function - now calls initialRenderBoard
  function renderBoard() {
    initialRenderBoard();
  }

  function shuffleBoardDOM() {
    // Get all tile elements in their current DOM order
    const currentTileElements = Array.from(boardEl.children);
    
    // Create a map of tile ID to element for quick lookup
    const tileElementMap = new Map();
    currentTileElements.forEach(el => {
      tileElementMap.set(el.dataset.id, el);
    });
    
    console.log(`Moving ${currentTileElements.length} DOM elements to match shuffled order`);
    
    // Reorder the DOM elements to match the shuffled boardTiles array
    boardTiles.forEach((tile, index) => {
      const tileEl = tileElementMap.get(tile.id);
      if (tileEl) {
        // Move the element to the correct position without recreating it
        boardEl.appendChild(tileEl);
      } else {
        console.warn(`Could not find DOM element for tile ${tile.id}`);
      }
    });
    
    // Update the tileEls map to maintain the correct order
    tileEls.clear();
    Array.from(boardEl.children).forEach(el => {
      tileEls.set(el.dataset.id, el);
    });
    
    
    // Update UI without re-rendering
    updateSelectionUI();
updateSubmitDisabled();
  }

  function reorderBoardDOM() {
    // Get all tile elements in their current DOM order
    const currentTileElements = Array.from(boardEl.children);
    
    // Create a map of tile ID to element for quick lookup
    const tileElementMap = new Map();
    currentTileElements.forEach(el => {
      tileElementMap.set(el.dataset.id, el);
    });
    
    
    // Reorder the DOM elements to match the new boardTiles array
    boardTiles.forEach((tile, index) => {
      const tileEl = tileElementMap.get(tile.id);
      if (tileEl) {
        // Move the element to the correct position without recreating it
        boardEl.appendChild(tileEl);
      } else {
        console.warn(`Could not find DOM element for tile ${tile.id}`);
      }
    });
    
    // Update the tileEls map to maintain the correct order
    tileEls.clear();
    Array.from(boardEl.children).forEach(el => {
      tileEls.set(el.dataset.id, el);
    });
    
    
    // Update UI without re-rendering
    updateSelectionUI();
updateSubmitDisabled();
  }

  function applyRing(el, tile) {
    // Only apply rings to tiles that don't have selections
    if (selections.index.has(tile.id)) {
      return; // Don't override selection colors
    }
    
    // Clear any existing ring classes
    el.classList.remove('ring', 'solved-ring', 'g1', 'g2', 'g3', 'g4');
    
    if (tile.locked) {
      // Solved tile: show true difficulty color with thicker outline
      el.classList.add('solved-ring');
      if (tile.difficulty === 'Easy') el.classList.add('g1');
      else if (tile.difficulty === 'Medium') el.classList.add('g2');
      else if (tile.difficulty === 'Hard') el.classList.add('g3');
      else if (tile.difficulty === 'Expert') el.classList.add('g4');
    } else if (tile.userTag) {
      // User-tagged tile: show difficulty color
      el.classList.add('ring');
      if (tile.userTag === 'Easy') el.classList.add('g1');
      else if (tile.userTag === 'Medium') el.classList.add('g2');
      else if (tile.userTag === 'Hard') el.classList.add('g3');
      else if (tile.userTag === 'Expert') el.classList.add('g4');
    }
  }

  // ========= SELECTION & GROUP SUBMISSION =========


  function updateSelectionUI() {
    // Update the selection logic to skip solved categories
    updateSelectionLogic();
    
    // clear all selection classes
    for (const [, el] of tileEls) {
      el.classList.remove('selected', 'g1', 'g2', 'g3', 'g4');
    }
    
    // Get solved categories to filter out
    const solvedCategories = getSolvedCategories();
    
    // Remove selections from locked tiles and tiles from solved categories
    const validSelections = [];
    selections.entries().forEach((ids, i) => {
      const validIds = ids.filter(id => {
        const tile = boardTiles.find(t => t.id === id);
        if (tile && (tile.locked || solvedCategories.has(tile.difficulty))) {
          // Remove from bucket if tile is now locked or belongs to solved category
          selections.remove(id);
          return false;
        }
        return true;
      });
      validSelections.push({ bucket: i, ids: validIds });
    });
    
    // Reapply valid selections with bucket-based colors
    validSelections.forEach(({ bucket, ids }) => {
      const colorClass = `g${bucket + 1}`; // g1, g2, g3, g4 based on bucket position
      ids.forEach(id => {
        const el = tileEls.get(id);
        if (el) {
          el.classList.add('selected', colorClass);
        }
      });
    });
    
    // Update rings for all tiles (solved tiles show true difficulty, selected tiles show bucket color)
    boardTiles.forEach(tile => {
      const el = tileEls.get(tile.id);
      if (el) {
        applyRing(el, tile);
      }
    });
    

    
    // enable submit if *any* bucket is full
    if (submitBtn) submitBtn.disabled = (selections.firstFullIdx() === -1);
  }

  function updateSubmitDisabled() {
  if (!submitBtn) return;
  if (isExpertMode()) {
    const allFull = selections.entries().every(arr => arr.length === selections.capacity);
    submitBtn.disabled = !allFull;            // Expert: only enable when all 4 groups (16 tiles) are filled
  } else {
    submitBtn.disabled = (selections.firstFullIdx() === -1); // Normal: enable when any bucket is full
  }
}
  
  function clearSelection() {
    selections.clearAll();
    updateSelectionUI();
    // Clear any progress messages
    showMessage("");
  }
  function onSubmitGroup() {
    const i = selections.firstFullIdx();
    if (i === -1) return; // nothing ready
    const ids = [...selections.buckets[i]];
    // Record this guess for share text (Normal mode only)
if (!isExpertMode()) {
  // `ids` is the 4 selected tile IDs
  pushShareRowFromIds(ids);
}
    const sel = boardTiles.filter(t => ids.includes(t.id));
    const countries = [...new Set(sel.map(t => t.country))];
    
    if (countries.length !== 1) {
      // Check for "one away" or "two away" scenarios
      const countryCounts = {};
      sel.forEach(tile => {
        countryCounts[tile.country] = (countryCounts[tile.country] || 0) + 1;
      });
      
      const maxCount = Math.max(...Object.values(countryCounts));
      
      if (maxCount === 3) {
        return wrongGuess("One away!");
      } else if (maxCount === 2) {
        return wrongGuess("Two away!");
      } else {
        return wrongGuess("Those 4 aren't the same country.");
      }
    }
    const country = countries[0];

    const finalize = () => {
      lockGroup(country, sel);
      selections.clearBucket(i);     // free that bucket
      updateSelectionUI();
    };

    if (REQUIRE_COUNTRY_GUESS) {
      promptCountryGuess(country).then(ok => ok ? finalize() : wrongGuess("country guess incorrect."));
    } else {
      finalize();
    }
  }
  function onSubmitGroupExpert() {
  // Require all 4 buckets (16 tiles) filled before grading
  const groups = selections.entries();
  const allFull = groups.every(arr => arr.length === selections.capacity);
  if (!allFull) {
    showMessage("Expert: pick all 16 tiles (4 groups) before submitting.", true);
    return;
  }
// Overwrite share history with this all-at-once attempt (4 rows)
shareAttempts = [];
const groupsNow = selections.entries(); // 4 arrays of 4 ids (Yellow, Teal, Purple, Red)
groupsNow.forEach(arr => pushShareRowFromIds(arr));
  // Ask the player to name Yellow/Teal/Purple/Red, then grade
  showExpertLabelModal((labels) => {
    // All-or-nothing: each group must be a single country
    const allCorrect = groups.every(arr => {
      const codes = new Set(arr.map(id => boardTiles.find(t => t.id === id)?.country));
      return codes.size === 1;
    });

if (allCorrect) {
  // Lock everything and finish
  groups.forEach(arr => {
    arr.forEach(id => {
      const t = boardTiles.find(x => x.id === id);
      if (t) t.locked = true;
    });
  });
  reorderBoardIntoCountryRows?.();
  selections.clearAll();
  updateSelectionUI();
  updateStatus?.();
  shareBtn?.removeAttribute("disabled");
  markSolvedToday(); // <<— ADD THIS LINE
  showCongratulationsOverlay?.();
} else {
      // One strike for the whole 16-tile attempt
      mistakesLeft -= 1;
      if (mistakesLeftEl) mistakesLeftEl.textContent = `Mistakes: ${mistakesLeft}`;
      if (mistakesLeft <= 0) {
        revealSolution?.();
      } else {
        showMessage("Not quite. Expert mode grades all four groups together.", true);
        selections.clearAll();
        updateSelectionUI();
        updateSubmitDisabled?.();
      }
    }
  });
}

  function lockGroup(country, tiles) {
    tiles.forEach(t => t.locked = true);
    addSolvedStripe(tiles[0].difficulty, country, tiles.map(t => t.url));
    
    // Add country codes to solved tiles
    tiles.forEach(tile => {
      const tileEl = tileEls.get(tile.id);
      if (tileEl) {
        addCountryCodeToTile(tileEl, tile.country);
      }
    });
    
    // Show success message
    const difficulty = tiles[0].difficulty;
    showMessage(`Correct! 🎉`, false);
    
    // Reorder board: move solved group to next available row
    reorderBoardAfterSolve();
    
    updateStatus();
    
// Check if all tiles are now locked (game solved)
const allSolved = boardTiles.every(t => t.locked);

if (allSolved) {
  // Game actually solved - set flag and show congratulations
  gameActuallySolved = true;
  markSolvedToday(); // <<— ADD THIS LINE
  showMessage("🎉 Congratulations! You solved the puzzle! 🎉", false);
  shareBtn?.removeAttribute("disabled");
  showCongratulationsOverlay();
}
  }

  function showExpertLabelModal(onConfirm) {
  // Overlay
  const overlay = document.createElement("div");
  overlay.className = "congrats-overlay";

  // Modal
  const modal = document.createElement("div");
  modal.className = "congrats-modal label-modal";

  const title = document.createElement("div");
  title.className = "label-title";
  title.textContent = "Name your four groups";

  // Inputs for Yellow / Green / Blue / Purple
const colors = ["yellow","teal","purple","red"];
  const labels = {};
  const list = document.createElement("div");
  list.className = "label-list";

  colors.forEach((c) => {
    const row = document.createElement("div");
    row.className = "label-row";

    const sw = document.createElement("span");
    sw.className = `swatch ${c}`;
    row.appendChild(sw);

    const lab = document.createElement("label");
    lab.textContent = c[0].toUpperCase() + c.slice(1) + ":";
    lab.style.minWidth = "72px";
    lab.style.color = "var(--muted)";
    row.appendChild(lab);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Country / group name";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.addEventListener("input", () => { labels[c] = input.value.trim(); });
    row.appendChild(input);

    list.appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "actions";
  const cancel = document.createElement("button");
  cancel.className = "btn";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => overlay.remove());
  const confirm = document.createElement("button");
  confirm.className = "btn primary";
  confirm.textContent = "Submit all";
  confirm.addEventListener("click", () => {
    overlay.remove();
    onConfirm?.(labels);
  });
  actions.appendChild(cancel);
  actions.appendChild(confirm);

  modal.appendChild(title);
  modal.appendChild(list);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // focus first input
  const firstInput = list.querySelector("input");
  if (firstInput) firstInput.focus();

  // click outside to close
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}
  
function reorderBoardAfterSolve() {
  // Count how many groups are solved
  const solvedCount = Math.floor(boardTiles.filter(t => t.locked).length / 4);
  if (solvedCount === 0) return;

  // Create new board order: solved groups first, then unsolved tiles
  const solvedTiles = boardTiles.filter(t => t.locked);
  const unsolvedTiles = boardTiles.filter(t => !t.locked);

  // Group solved tiles by their original positions to maintain row order
  const solvedGroups = [];
  for (let i = 0; i < solvedCount; i++) {
    const startIdx = i * 4;
    solvedGroups.push(solvedTiles.slice(startIdx, startIdx + 4));
  }

  // Rebuild boardTiles array: solved groups in top rows, unsolved below
  const newBoardTiles = [];

  // Add solved groups to top rows
  solvedGroups.forEach(group => {
    newBoardTiles.push(...group);
  });

  // Add remaining unsolved tiles
  newBoardTiles.push(...unsolvedTiles);

  // Update the boardTiles array
  boardTiles = newBoardTiles;

  // Reorder DOM elements without re-rendering
  reorderBoardDOM();
}
// Put all 4 tiles from the same country on the same row (end-of-game tidy-up)
function reorderBoardIntoCountryRows() {
  // Build stable “first seen” order for countries
  const firstIndex = new Map();
  boardTiles.forEach((t, i) => {
    if (!firstIndex.has(t.country)) firstIndex.set(t.country, i);
  });

  // Group tiles by country
  const byCountry = new Map();
  for (const t of boardTiles) {
    if (!byCountry.has(t.country)) byCountry.set(t.country, []);
    byCountry.get(t.country).push(t);
  }

  // Order countries by where they first appeared on the board (stable to user)
  const orderedCountries = Array.from(byCountry.keys())
    .sort((a, b) => firstIndex.get(a) - firstIndex.get(b));

  // Flatten into rows of 4 by country
  const newBoardTiles = [];
  for (const c of orderedCountries) {
    const tiles = byCountry.get(c) || [];
    newBoardTiles.push(...tiles);
  }

  // Apply and sync DOM
  boardTiles = newBoardTiles;
  reorderBoardDOM();
}

  function addSolvedStripe(difficulty, country, urls) {
  }
  function wrongGuess(msg) {
    mistakesLeft--;
    updateStatus();
    showMessage(`${msg} (${mistakesLeft} mistakes left)`, true);
    if (mistakesLeft <= 0) revealSolution();
  }
  function revealSolution() {
    // Lock all remaining tiles and end the game
    boardTiles.forEach(t => t.locked = true);
    selections.clearAll();
    updateSelectionUI();
    showMessage("Out of mistakes!");
    updateStatus();
    
// Add country codes to all tiles since they're now revealed
boardTiles.forEach(tile => {
  const tileEl = tileEls.get(tile.id);
  if (tileEl) addCountryCodeToTile(tileEl, tile.country);
});

// Reorder into country rows so the end-state looks solved
reorderBoardIntoCountryRows();

// Game ended (failed) - enable sharing
shareBtn?.removeAttribute("disabled");
    
// Only show congratulations if the game was actually solved, not just failed
const allSolved = boardTiles.every(t => t.locked);
if (allSolved && gameActuallySolved) {
  showCongratulationsOverlay();
} else {
  showFailureOverlay(); // <— show the CTA + daily challenge even on failure
}
  }
  function updateStatus() {
    if (groupsRemainingEl) {
      const solvedGroups = Math.floor(boardTiles.filter(t => t.locked).length / 4);
      groupsRemainingEl.textContent = `Groups: ${4 - solvedGroups}`;
    }
    if (mistakesLeftEl) {
      mistakesLeftEl.textContent = `Mistakes: ${mistakesLeft}`;
    }
  }

  // Hide or show message area appropriately
  function showMessage(text, isError = false) {
    if (!messageEl) return;
    if (text) {
      messageEl.style.display = "block";
      messageEl.textContent = text;
      messageEl.style.color = isError ? "var(--bad)" : "var(--muted)";
    } else {
      messageEl.textContent = "";
      messageEl.style.display = "none";
    }
  }


  // ========= SHARE (RESULTS) =========
  function tilesForShareCanonical() {
    const byManual = { Easy: [], Medium: [], Hard: [], Expert: [] };
    const byDiff   = { Easy: [], Medium: [], Hard: [], Expert: [] };
    for (const t of boardTiles) {
      if (t.userTag) byManual[t.userTag].push(t);
      if (t.difficulty) byDiff[t.difficulty].push(t);
    }
    // Use user-tagged grouping if all 4 tags are assigned correctly, otherwise use actual difficulty grouping
    const useManual = (
      byManual.Easy.length === 4 &&
      byManual.Medium.length === 4 &&
      byManual.Hard.length === 4 &&
      byManual.Expert.length === 4
    );
    const source = useManual ? byManual : byDiff;
    return ["Easy", "Medium", "Hard", "Expert"].flatMap(diff => (source[diff] || []).slice(0, 4));
  }
// Map true group difficulty -> emoji squares (Yellow, Teal(Blue), Purple, Red)
const DIFF_TO_EMOJI = { Easy: "🟨", Medium: "🟦", Hard: "🟪", Expert: "🟥" };

// Push one "guess row" to the share history
function pushShareRowFromIds(ids) {
  const row = ids.map(id => {
    const t = boardTiles.find(x => x.id === id);
    return DIFF_TO_EMOJI[t?.difficulty] || "⬜";
  }).join("");
  shareAttempts.push(row);
}
// ========= STREAK (UTC, per puzzle number) =========
const STREAK_KEY = "gnx_streak";
const LAST_SOLVED_KEY = "gnx_last_solved_puzzle";

function currentPuzzleNumber() {
  return (typeof resolvePuzzleNumberFromURLOrUTC === "function" && resolvePuzzleNumberFromURLOrUTC())
      || (typeof todayPuzzleNumberUTC === "function" && todayPuzzleNumberUTC())
      || (window.currentPuzzleNumber || 1);
}

function getStreak() {
  return Number(localStorage.getItem(STREAK_KEY) || 0);
}

// Call this once when the puzzle is actually solved.
// It increments if yesterday’s was solved; otherwise resets to 1.
// It also guards against counting twice on the same puzzle.
function markSolvedToday() {
  const n = currentPuzzleNumber();
  const last = Number(localStorage.getItem(LAST_SOLVED_KEY) || 0);
  let streak = getStreak();

  if (last === n) return streak;          // already counted for this puzzle
  if (last === n - 1) streak = streak + 1; // consecutive
  else streak = 1;                          // broken streak (or first solve)

  localStorage.setItem(STREAK_KEY, String(streak));
  localStorage.setItem(LAST_SOLVED_KEY, String(n));
  return streak;
}
function buildShareText() {
  // Use recorded attempts if present; otherwise fall back to the final 4×4
  const rows = (shareAttempts && shareAttempts.length)
    ? shareAttempts.slice()
    : (() => {
        const tiles = tilesForShareCanonical();
        const tmp = ["", "", "", ""];
        tiles.forEach((t, i) => {
          const r = Math.floor(i / 4);
          const emoji = DIFF_TO_EMOJI[(t.userTag || t.difficulty)] || "⬜";
          tmp[r] += emoji;
        });
        return tmp;
      })();

  // Figure out the puzzle number you’re on
  const puzzleNo =
    (typeof resolvePuzzleNumberFromURLOrUTC === "function" && resolvePuzzleNumberFromURLOrUTC()) ||
    (typeof todayPuzzleNumberUTC === "function" && todayPuzzleNumberUTC()) ||
    (window.currentPuzzleNumber || 1);

  // Header ONLY: "Geonections #<n>", then the rows. Nothing else.
  const streak = getStreak();
  return `Geonections #${puzzleNo}\nStreak ${streak}\n${rows.join("\n")}`;
}
async function onShare() {
  const text = buildShareText();

  // Try modern clipboard API first
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showMessage("Copied!");
      return;
    }
  } catch (_) {
    // fall through to fallback
  }

  // Fallback: temporary textarea
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    showMessage("Copied!");
  } catch (_) {
    showMessage("Press ⌘/Ctrl+C to copy from console.", true);
    console.log(text);
  }
  document.body.removeChild(textarea);
}

  // ========= HELPERS =========
  function applyExpertBlindTile() {
  if (!isExpertMode()) return;
  // Pick a hard/expert tile if available, otherwise random unsolved tile
  const candidates = boardTiles.filter(t => /expert|hard/i.test(String(t.difficulty || "")) && !t.locked);
  const pool = candidates.length ? candidates : boardTiles.filter(t => !t.locked);
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  pick.blind = true;
const el = tileEls.get(pick.id);
  if (el) el.classList.add("blind");
}
  function getSolvedCategories() {
    const solvedCategories = new Set();
    const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
    
    // Count how many tiles of each difficulty are locked (solved)
    boardTiles.forEach(tile => {
      if (tile.locked) {
        difficultyCounts[tile.difficulty]++;
      }
    });
    
    // If a difficulty has 4 locked tiles, it's completely solved
    Object.entries(difficultyCounts).forEach(([difficulty, count]) => {
      if (count === 4) {
        solvedCategories.add(difficulty);
      }
    });
    
    return solvedCategories;
  }
  
  function updateSelectionLogic() {
    const solvedCategories = getSolvedCategories();
    
    // Create a new firstOpen function that skips solved categories
    const newFirstOpen = () => {
      // Map difficulty to bucket index: Easy=0, Medium=1, Hard=2, Expert=3
      const difficultyToBucket = { Easy: 0, Medium: 1, Hard: 2, Expert: 3 };
      
      // Find the first available bucket that doesn't correspond to a solved category
      for (let i = 0; i < 4; i++) {
        const difficulty = Object.keys(difficultyToBucket).find(d => difficultyToBucket[d] === i);
        if (!solvedCategories.has(difficulty) && selections.buckets[i].size < 4) {
          return i;
        }
      }
      return -1; // No available buckets
    };
    
    selections.updateFirstOpen(newFirstOpen);
  }
  
  function maybeAutoLock(country) {
    // If all 4 from this country are guessed correctly, auto-solve the group
    const groupTiles = boardTiles.filter(t => t.country === country && !t.locked);
    if (groupTiles.length === 4 && groupTiles.every(t => t.userCorrect)) {
      lockGroup(country, groupTiles);
    }
  }
  function extractISO2(s) {
    const m = String(s || "").match(/^[A-Za-z]{2}$/);
    return m ? m[0].toUpperCase() : "";
  }
  function compareCountries(input, answer) {
    if (norm(input) === norm(answer)) return true;
    const aCode = nameOrCodeToCode(answer);
    const nCode = NAME_TO_CODE.get(norm(input));
    if (nCode && aCode && nCode === aCode) return true;
    const iso = extractISO2(input);
    return !!(iso && aCode && iso === aCode);
  }
  function tinted(hex, alpha) {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function capitalize(str) {
    return str ? str[0].toUpperCase() + str.slice(1).toLowerCase() : str;
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function sampleN(arr, n) {
    const copy = [...arr];
    shuffle(copy);
    return copy.slice(0, n);
  }
  function promptCountryGuess(correctCountry) {
    return new Promise(resolve => {
      // Create overlay
      const overlay = document.createElement("div");
      overlay.className = "country-guess-overlay";
      
      // Create modal content
      const modal = document.createElement("div");
      modal.className = "country-guess-modal";
      
      const title = document.createElement("h3");
      title.className = "country-guess-title";
      title.textContent = "Enter the country name or 2-letter code";
      
      const input = document.createElement("input");
      input.className = "country-guess-input";
      input.type = "text";
      input.placeholder = "e.g., France or FR";
      input.autocomplete = "off";
      
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "country-guess-buttons";
      
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "country-guess-btn";
      cancelBtn.textContent = "Cancel";
      
      const submitBtn = document.createElement("button");
      submitBtn.className = "country-guess-btn primary";
      submitBtn.textContent = "Submit";
      
      // Add event listeners
      const cleanup = () => {
        document.body.removeChild(overlay);
        resolve(false);
      };
      
      cancelBtn.addEventListener("click", cleanup);
      
      const submitGuess = () => {
        const guess = input.value.trim();
        if (guess) {
          document.body.removeChild(overlay);
          resolve(compareCountries(guess, correctCountry));
        }
      };
      
      submitBtn.addEventListener("click", submitGuess);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGuess();
});

      
      // Focus input and select text
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
      
      // Assemble and show
      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(submitBtn);
      modal.appendChild(title);
      modal.appendChild(input);
      modal.appendChild(buttonContainer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    });
  }

  function showCongratulationsOverlay() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "congrats-overlay";
    
    // Create modal content
    const modal = document.createElement("div");
    modal.className = "congrats-modal";
    
    const icon = document.createElement("span");
    icon.className = "congrats-icon";
    icon.textContent = "🎉";
    
    const title = document.createElement("h2");
    title.className = "congrats-title";
    title.textContent = "Congratulations!";
    
  const message = document.createElement("p");
message.className = "congrats-message";
const max = getMaxMistakes();
const mistakesUsed = max - mistakesLeft;
message.innerHTML = `
  You’ve solved the puzzle in <strong>${mistakesUsed}</strong> mistake${mistakesUsed === 1 ? '' : 's'}! Share your results with friends.
  <br><br>
  Play the GeoGuessr daily challenge to see how you stack up against other geonection players!
  <br>
  <strong>Today’s Challenge:</strong> <span id="daily-challenge-slot"></span>
`;
    
    const shareBtn = document.createElement("button");
    shareBtn.className = "congrats-share-btn";
    shareBtn.textContent = "Share Results";
    
    const copyFeedback = document.createElement("div");
    copyFeedback.className = "congrats-copy-feedback";
    copyFeedback.textContent = "✓ Copied to clipboard!";
    
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "congrats-dismiss-btn";
    dismissBtn.textContent = "Dismiss";
    
    // Add event listener for share button
    shareBtn.addEventListener("click", () => {
      onShare();
      // Show copy feedback
      copyFeedback.classList.add("show");
      // Hide feedback after 3 seconds
      setTimeout(() => {
        copyFeedback.classList.remove("show");
      }, 3000);
    });
    
    // Add event listener for dismiss button
    dismissBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
    
    // Assemble and show
    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(shareBtn);
    modal.appendChild(copyFeedback);
    modal.appendChild(dismissBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // === Mount the daily challenge link ===
    {
      const slot = overlay.querySelector("#daily-challenge-slot");
      if (slot) {
        const c = todayChallenge();
        const a = document.createElement("a");
        a.href = c.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = c.name;
        slot.replaceChildren(a); // clear and insert link
      }
    }
  } // <-- CLOSES showCongratulationsOverlay()
  function showFailureOverlay() {
  // Overlay root
  const overlay = document.createElement("div");
  overlay.className = "congrats-overlay";

  // Modal
  const modal = document.createElement("div");
  modal.className = "congrats-modal";

  // Emoji / title
  const title = document.createElement("div");
  title.className = "congrats-title";
  title.textContent = "Good try!";

  // Message + daily challenge slot
  const message = document.createElement("div");
  message.className = "congrats-message";
  message.innerHTML = `
    You ran out of mistakes. Better luck next time!
    <br><br>
    <strong>Today’s Challenge:</strong> <span id="daily-challenge-slot"></span>
  `;

  // Share button (re-use your existing onShare wiring through the main header button)
  const shareBtnLocal = document.createElement("button");
  shareBtnLocal.className = "congrats-share-btn";
  shareBtnLocal.textContent = "Share Results";
  shareBtnLocal.addEventListener("click", () => {
    // This clicks the main Share button so you keep one sharing path.
    document.querySelector("#share-btn")?.click();
  });

  // Dismiss
  const dismissBtn = document.createElement("button");
  dismissBtn.className = "dismiss-btn";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", () => overlay.remove());

  // Assemble
  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(shareBtnLocal);
  modal.appendChild(dismissBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Inject today's challenge link
  try {
    const slot = message.querySelector("#daily-challenge-slot");
    if (slot) {
      const c = todayChallenge(); // already defined in your file
      const a = document.createElement("a");
      a.href = c.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = c.name;
      slot.appendChild(a);
    }
  } catch (e) {
    console.error("Failed to inject challenge link:", e);
  }

  // Close if user clicks the dimmed backdrop
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

  // Keep a single helper to show 2-letter country code on tiles
  function addCountryCodeToTile(tileEl, country) {
    // Check if country code already exists
    if (tileEl.querySelector('.dev-country-code')) {
      return;
    }
    const countryCode = document.createElement("div");
    countryCode.className = "dev-country-code";
    countryCode.textContent = country;
    tileEl.appendChild(countryCode);
  }

})();

