(() => {
  // ========= CONFIG =========
  const STREET_VIEW_API_KEY = "AIzaSyAb2IZiueqc9Io7GSYAp2hy6nvvUL_WdJw"; // your key
  const REQUIRE_COUNTRY_GUESS = true;
  const MAX_MISTAKES = 4;
  // Use Static Street View in fullscreen? (false = pano mode, locked POV)
  const USE_STATIC_IN_VIEWER = false;
  const DIFF_COLORS = { Easy: "#FACC15", Medium: "#14B8A6", Hard: "#A855F7", Expert: "#EF4444" };
  const DIFF_EMOJI  = { Easy: "🟨", Medium: "🟦", Hard: "🟪", Expert: "🟥" };
  const TAG_ORDER   = ["Easy", "Medium", "Hard", "Expert"];

  // ========= STATE =========
  let allData = [];
  let boardTiles = [];
  let solvedCountries = new Set();
  let selectedIds = new Set();
  let mistakesLeft = MAX_MISTAKES;
  let currentTile = null;
  let lastClickedTile = null;
  let tagStep = 0;
  const tagCounts = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
  // Track which JSON file was loaded (for debug display)
  let loadedSource = "";

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

  const headerEl    = document.querySelector(".site-header");
  const containerEl = document.querySelector(".container");
  const controlsEl  = ensure(".controls",
    `<div class="controls">
       <button id="submit-btn" class="btn primary" type="button">Submit Group</button>
       <button id="deselect-btn" class="btn" type="button">Deselect</button>
       <button id="shuffle-btn" class="btn" type="button">Shuffle</button>
       <button id="share-btn" class="btn" type="button" disabled>Share</button>
     </div>`,
    headerEl ? ".site-header" : null
  );
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

  const tileModal     = $("#tile-modal");
  const tileClose     = $("#tile-close");
  const panoEl        = $("#pano");
  const freezeOverlay = $("#freeze-overlay");
  const guessForm     = $("#guess-form");
  const guessInput    = $("#guess-input");
  const guessFeedback = $("#guess-feedback");
  const suggestions   = $("#country-suggestions");
  const infoModal     = $("#info-modal");
  const infoClose     = $("#info-close");

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
      const puzzle = new URLSearchParams(location.search).get("puzzle") || "1";
      // Try multiple filename patterns (to handle spaces, encoding, etc.)
      const candidates = [
        `./Geonections%20%23${puzzle}.json`,     // e.g., "Geonections #1.json" (with encoded '#')
        `./Geonections%2520%2523${puzzle}.json`, // double-encoded edge case
        `./Geonections%20${puzzle}.json`,        // "Geonections 1.json"
        `./Geonections_${puzzle}.json`,          // "Geonections_1.json"
        `./Geonections-${puzzle}.json`,          // "Geonections-1.json"
        `./Geonections.json`,                    // fallback to generic name
        `./geonections.json`,
        `/Geonections.json`
      ];
      const { json, used } = await tryFetchJSON(candidates);
      loadedSource = used;
      allData = normalizeGeonections(json);
      startNewGame();
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
  submitBtn?.addEventListener("click", onSubmitGroup);
  deselectBtn?.addEventListener("click", clearSelection);
  shuffleBtn?.addEventListener("click", () => {
    // Shuffle only unsolved tiles, keep solved ones at end
    const unsolved = boardTiles.filter(t => !t.locked);
    const solved = boardTiles.filter(t => t.locked);
    shuffle(unsolved);
    boardTiles = unsolved.concat(solved);
    renderBoard();
    showMessage("");
  });
  shareBtn?.addEventListener("click", onShare);

  tileClose?.addEventListener("click", closeTileModal);
  tileModal?.addEventListener("click", (e) => { if (e.target === tileModal) closeTileModal(); });
  infoClose?.addEventListener("click", () => infoModal?.classList.add("hidden"));
  infoModal?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      infoModal.classList.add("hidden");
    }
  });
  guessForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentTile) return;
    const guess = String(guessInput.value || "").trim();
    if (!guess) return;
    const ok = compareCountries(guess, currentTile.country);
    if (ok) {
      currentTile.userCorrect = true;
      guessFeedback.textContent = "Correct!";
      guessFeedback.className = "guess-feedback correct";
      renderBoard();
      maybeAutoLock(currentTile.country);
      setTimeout(closeTileModal, 350);
    } else {
      guessFeedback.textContent = "Incorrect.";
      guessFeedback.className = "guess-feedback incorrect";
      mistakesLeft--;
      updateStatus();
      if (mistakesLeft <= 0) revealSolution();
    }
  });

  // Press 'F' key to open Street View fullscreen on the last clicked tile
  window.addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") &&
        (!document.activeElement || !/^(input|textarea)$/i.test(document.activeElement.tagName))) {
      if (lastClickedTile && tileModal?.classList.contains("hidden")) {
        openTileModal(lastClickedTile);
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
    const fov   = opts.fov ?? 90;
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
  function fullscreenURLForTile(tile) {
    const { baseW, baseH } = computeBestBaseSize();
    return buildStreetViewURL(tile, { w: baseW, h: baseH, fov: 90 });
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
    solvedCountries.clear();
    selectedIds.clear();
    mistakesLeft = MAX_MISTAKES;
    tagStep = 0;
    tagCounts.Easy = tagCounts.Medium = tagCounts.Hard = tagCounts.Expert = 0;
    const puzzle = buildPuzzle16(allData);
    debugBar.textContent = `Parsed: ${allData.length} → Built: ${puzzle.ok ? puzzle.tiles.length : 0}${loadedSource ? `  (file: ${loadedSource})` : ""}`;
    if (!puzzle.ok) {
      boardEl.innerHTML = "";
      solvedEl.innerHTML = "";
      updateStatus();
      showMessage(puzzle.error || "Not enough valid items to build a 4×4 board.", true);
      return;
    }
    boardTiles = shuffle(puzzle.tiles).map(t => ({ ...t, locked: !!t.locked }));
    solvedEl.innerHTML = "";
    renderBoard();
    updateStatus();
  }

  function buildPuzzle16(data) {
    const valid = (data || []).filter(t => t && t.country && t.difficulty && t.id);
    if (valid.length === 16) {
      // Exactly 16 valid tiles provided, use them directly
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
        return { ok: true, tiles };
      }
    }
    // Final fallback: just take the first 16 valid locations
    const fallback = valid.slice(0, 16).map(t => ({ ...t, locked: false }));
    if (fallback.length === 16) {
      console.warn("[Geonections] Using final fallback — check your JSON tags (country/difficulty).");
      return { ok: true, tiles: fallback };
    }
    return { ok: false, error: "Not enough valid items to build a 4×4 board. Check JSON tags for country/difficulty." };
  }

  // ========= RENDER =========
  function renderBoard() {
    boardEl.innerHTML = "";
    for (const tile of boardTiles) {
      const btn = document.createElement("button");
      btn.className = "tile";
      btn.type = "button";
      btn.dataset.id = tile.id;
      btn.setAttribute("aria-pressed", selectedIds.has(tile.id) ? "true" : "false");
      btn.classList.toggle("locked", !!tile.locked);
      if (tile.url) {
        const img = document.createElement("img");
        img.src = tile.url;
        img.alt = "";
        btn.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "noimg";
        ph.textContent = "No Image";
        btn.appendChild(ph);
      }
      // Difficulty ring (tag or solved)
      const ringColor = tile.userTag ? DIFF_COLORS[tile.userTag] : (tile.locked ? DIFF_COLORS[tile.difficulty] : null);
      if (ringColor) {
        btn.classList.add("ring");
        btn.style.setProperty("--ring-color", ringColor);
      }
      // Corner tag button (to cycle difficulty tag)
      const corner = document.createElement("button");
      corner.type = "button";
      corner.className = "corner";
      corner.title = "Tag tile";
      corner.style.background = tile.userTag ? DIFF_COLORS[tile.userTag] : "rgba(0,0,0,0.28)";
      corner.addEventListener("click", (e) => {
        e.stopPropagation();
        onCornerTag(tile);
      });
      btn.appendChild(corner);
      // Fullscreen icon button (opens Street View modal)
      const fs = document.createElement("button");
      fs.type = "button";
      fs.className = "fullscreen-icon";
      fs.title = "Fullscreen";
      fs.textContent = "⛶";
      fs.addEventListener("click", (e) => {
        e.stopPropagation();
        lastClickedTile = tile;
        openTileModal(tile);
      });
      btn.appendChild(fs);
      // Click to select/deselect, double-click to open fullscreen
      btn.addEventListener("dblclick", () => {
        lastClickedTile = tile;
        openTileModal(tile);
      });
      btn.addEventListener("click", () => {
        lastClickedTile = tile;
        if (!tile.locked) toggleSelect(tile.id);
      });
      boardEl.appendChild(btn);
    }
    if (submitBtn) {
      submitBtn.disabled = (selectedIds.size !== 4);
    }
    fitBoardToViewport();
  }

  // ========= TAGGING (Difficulty labeling) =========
  function onCornerTag(tile) {
    const prev = tile.userTag;
    if (prev) {
      tagCounts[prev] = Math.max(0, tagCounts[prev] - 1);
    }
    let tag = TAG_ORDER[tagStep] || null;
    if (tag && tagCounts[tag] >= 4) {
      tagStep = Math.min(TAG_ORDER.length, tagStep + 1);
      tag = TAG_ORDER[tagStep] || null;
    }
    tile.userTag = tag || null;
    if (tile.userTag) {
      tagCounts[tile.userTag] += 1;
    }
    renderBoard();
  }

  // ========= SELECTION & GROUP SUBMISSION =========
  function toggleSelect(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else if (selectedIds.size < 4) {
      selectedIds.add(id);
    }
    renderBoard();
    showMessage("");
  }
  function clearSelection() {
    selectedIds.clear();
    renderBoard();
    showMessage("");
  }
  function onSubmitGroup() {
    if (selectedIds.size !== 4) return;
    const sel = boardTiles.filter(t => selectedIds.has(t.id));
    const countries = [...new Set(sel.map(t => t.country))];
    if (countries.length !== 1) {
      return wrongGuess("Those 4 images aren’t all from the same country.");
    }
    const country = countries[0];
    if (solvedCountries.has(country)) {
      return wrongGuess("That country is already solved.");
    }
    if (REQUIRE_COUNTRY_GUESS) {
      promptCountryGuess(country).then(ok => {
        if (ok) lockGroup(country, sel);
        else wrongGuess("Country guess incorrect for that group.");
      });
    } else {
      lockGroup(country, sel);
    }
  }
  function lockGroup(country, tiles) {
    solvedCountries.add(country);
    tiles.forEach(t => t.locked = true);
    addSolvedStripe(tiles[0].difficulty, country, tiles.map(t => t.url));
    selectedIds.clear();
    renderBoard();
    updateStatus();
    showMessage(solvedCountries.size === 4 ? "🎉 All groups found!" : `Correct! You found ${country}.`);
    if (solvedCountries.size === 4) {
      // Game solved – enable sharing
      shareBtn?.removeAttribute("disabled");
    }
  }
  function addSolvedStripe(difficulty, country, urls) {
    const wrap = document.createElement("div");
    wrap.className = "solved-group";
    wrap.style.background = tinted(DIFF_COLORS[difficulty] || "#888", 0.22);
    urls.forEach(u => {
      const img = document.createElement("img");
      img.src = u || "";
      img.alt = "";
      img.style.width = "100%";
      img.style.height = "64px";
      img.style.objectFit = "cover";
      img.style.borderRadius = ".5rem";
      wrap.appendChild(img);
    });
    const label = document.createElement("div");
    label.className = "solved-label";
    label.textContent = `${country} — ${difficulty}`;
    wrap.appendChild(label);
    solvedEl?.appendChild(wrap);
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
    renderBoard();
    showMessage("Out of mistakes!");
    updateStatus();
    // Game ended (failed) – enable sharing
    shareBtn?.removeAttribute("disabled");
  }
  function updateStatus() {
    if (groupsRemainingEl) {
      groupsRemainingEl.textContent = `Groups: ${4 - solvedCountries.size}`;
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

  // ========= FULLSCREEN STREET VIEW MODAL =========
  let mapsReadyPromise = null;
  let pano = null;
  let blockKeys = null;
  function ensureMapsJS() {
    if (window.google?.maps?.StreetViewPanorama) {
      return Promise.resolve();
    }
    if (!mapsReadyPromise) {
      mapsReadyPromise = new Promise((resolve, reject) => {
        const cb = "__g_cb_" + Math.random().toString(36).slice(2);
        window[cb] = () => {
          resolve();
          // Clean up the callback global
          setTimeout(() => { try { delete window[cb]; } catch {} }, 0);
        };
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(STREET_VIEW_API_KEY)}&callback=${cb}&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onerror = () => reject(new Error("Maps JS failed"));
        document.head.appendChild(script);
      });
    }
    return mapsReadyPromise;
  }
  async function openTileModal(tile) {
    // Populate country suggestions for guess input (all distinct countries on board)
    suggestions.innerHTML = "";
    for (const c of [...new Set(boardTiles.map(t => t.country))]) {
      const opt = document.createElement("option");
      opt.value = c;
      suggestions.appendChild(opt);
      const code = nameOrCodeToCode(c);
      if (code) {
        const opt2 = document.createElement("option");
        opt2.value = code;
        suggestions.appendChild(opt2);
      }
    }
    guessInput.value = "";
    guessFeedback.textContent = "";
    guessFeedback.className = "guess-feedback";
    tileModal.classList.remove("hidden");
    try {
      if (tileModal.requestFullscreen) {
        await tileModal.requestFullscreen();
      }
    } catch (_) {}
    panoEl.innerHTML = "";
    currentTile = tile;
    if (USE_STATIC_IN_VIEWER) {
      // Show a static Street View image (no interaction)
      const img = document.createElement("img");
      img.alt = "";
      img.src = fullscreenURLForTile(tile);
      img.style.cssText = "position:absolute; inset:0; width:100%; height:100%; object-fit:cover;";
      panoEl.appendChild(img);
      if (freezeOverlay) freezeOverlay.style.display = "none";
      setTimeout(() => guessInput.focus(), 50);
      return;
    }
    // Interactive panorama (locked controls)
    try {
      await ensureMapsJS();
      const opts = {
        addressControl: false,
        linksControl: false,
        clickToGo: false,
        zoomControl: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        disableDefaultUI: true
      };
      if (tile.panoId) {
        opts.pano = tile.panoId;
      } else {
        opts.position = { lat: tile.lat, lng: tile.lng };
      }
      pano = new google.maps.StreetViewPanorama(panoEl, opts);
      const fixedPov = { heading: tile.heading || 0, pitch: tile.pitch || 0 };
      pano.setPov(fixedPov);
      const fixedZoom = pano.getZoom();
      google.maps.event.addListener(pano, "pov_changed", () => {
        const p = pano.getPov();
        if (Math.abs(p.heading - fixedPov.heading) > 0.1 || Math.abs(p.pitch - fixedPov.pitch) > 0.1) {
          pano.setPov(fixedPov);
        }
      });
      google.maps.event.addListener(pano, "zoom_changed", () => {
        if (pano.getZoom() !== fixedZoom) {
          pano.setZoom(fixedZoom);
        }
      });
      google.maps.event.addListener(pano, "position_changed", () => {
        if (tile.panoId) {
          pano.setPano(tile.panoId);
        } else {
          pano.setPosition({ lat: tile.lat, lng: tile.lng });
        }
      });
      // Block arrow keys and other controls while in pano
      blockKeys = (e) => {
        const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "+", "-", "=", "_"];
        if (keys.includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener("keydown", blockKeys, { capture: true });
      // Show overlay to prevent dragging the view
      if (freezeOverlay) {
        freezeOverlay.style.display = "block";
        freezeOverlay.style.pointerEvents = "auto";
      }
      // Refresh pano size after entering fullscreen or resizing
      const refresh = () => {
        try {
          google.maps.event.trigger(pano, "resize");
        } catch (_) {}
      };
      setTimeout(refresh, 80);
      setTimeout(refresh, 200);
      window.addEventListener("resize", refresh);
      document.addEventListener("fullscreenchange", refresh, { passive: true });
    } catch (err) {
      // Fallback: just show static image if Google Maps JS fails
      const img = document.createElement("img");
      img.alt = "";
      img.src = fullscreenURLForTile(tile);
      img.style.cssText = "position:absolute; inset:0; width:100%; height:100%; object-fit:cover;";
      panoEl.appendChild(img);
      if (freezeOverlay) freezeOverlay.style.display = "none";
      console.warn("Viewer fallback:", err);
    }
    setTimeout(() => guessInput.focus(), 50);
  }
  function closeTileModal() {
    tileModal.classList.add("hidden");
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (freezeOverlay) {
      freezeOverlay.style.display = "none";
    }
    if (blockKeys) {
      try {
        window.removeEventListener("keydown", blockKeys, { capture: true });
      } catch (_) {}
      blockKeys = null;
    }
    pano = null;
    panoEl.innerHTML = "";
    currentTile = null;
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
  function buildShareText() {
    const tiles = tilesForShareCanonical();
    const lines = [];
    for (let r = 0; r < 4; r++) {
      const rowTiles = tiles.slice(r * 4, r * 4 + 4);
      const row = rowTiles.map(t => DIFF_EMOJI[(t.userTag || t.difficulty)] || "⬜").join("");
      lines.push(row);
    }
    const mistakesUsed = MAX_MISTAKES - mistakesLeft;
    const status = solvedCountries.size === 4 ? "Solved" : "Ended";
    return `Geonections — ${status} (${mistakesUsed} mistakes)\n${lines.join("\n")}`;
  }
  async function onShare() {
    const text = buildShareText();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showMessage("Copied!");
        return;
      }
    } catch (_) {}
    // Fallback copy method
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
      const guess = window.prompt("Type the country (name or 2-letter code):");
      if (guess == null) return resolve(false);
      resolve(compareCountries(guess, correctCountry));
    });
  }

  // ========= RESPONSIVE GRID SIZING =========
  function fitBoardToViewport() {
    try {
      const COLS = 4, ROWS = 4;
      const styles = getComputedStyle(boardEl);
      const gap = parseFloat(styles.gap || styles.columnGap || 8);
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const availW = Math.max(200, containerEl?.clientWidth || vw);
      const headerH = headerEl?.offsetHeight || 56;
      const controlsH = controlsEl?.offsetHeight || 0;
      const misc = 8; // small padding
      const availH = Math.max(200, vh - headerH - controlsH - misc);
      const tileW_fromWidth  = (availW - gap * (COLS - 1)) / COLS;
      const tileH_fromHeight = (availH - gap * (ROWS - 1)) / ROWS;
      const tileW_fromHeight = tileH_fromHeight * (16 / 10);  // maintain 16:10 aspect ratio
      let tileW = Math.floor(Math.min(tileW_fromWidth, tileW_fromHeight));
      tileW = Math.max(160, tileW);
      boardEl.style.gridTemplateColumns = `repeat(${COLS}, ${tileW}px)`;
    } catch (_) {
      // ignore errors (in case boardEl not yet in DOM)
    }
  }
  window.addEventListener("resize", fitBoardToViewport);
  document.addEventListener("DOMContentLoaded", fitBoardToViewport);
})();