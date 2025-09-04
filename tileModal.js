// ========= TILE MODAL FUNCTIONALITY =========

// Configuration
const USE_STATIC_IN_VIEWER = false;

// State variables
let pano = null;
let blockKeys = null;
let currentTile = null;

// DOM elements
const tileModal = document.querySelector("#tile-modal");
const panoEl = document.querySelector("#pano");
const freezeOverlay = document.querySelector("#freeze-overlay");
const guessInput = document.querySelector("#guess-input");

// Helper function to ensure Google Maps JS is loaded
async function ensureMapsJS() {
  if (window.google?.maps?.StreetViewPanorama) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // Access API key from main script
    const apiKey = window.STREET_VIEW_API_KEY;
    if (!apiKey) return;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Helper function to build fullscreen URL for a tile
function fullscreenURLForTile(tile) {
  const base = "https://www.google.com/maps/embed/v1/streetview";
  const w = 1200;
  const h = 800;
  const scale = 2;
  const sizeParams = `size=${w * scale}x${h * scale}`;
  
  if (tile.panoId) {
    return `${base}?pano=${encodeURIComponent(tile.panoId)}&${sizeParams}`;
  }
  
  const { lat, lng, heading = 0, pitch = 0 } = tile;
  return `${base}?location=${lat},${lng}&heading=${heading}&pitch=${pitch}&${sizeParams}`;
}

// Main function to open the tile modal
async function openTileModal(tile) {
  tileModal.classList.remove("hidden");
  panoEl.innerHTML = "";
  currentTile = tile;

  // listen for F / ESC
  const keyHandler = (e) => {
    if (e.key === "Escape" || e.key.toLowerCase() === "f") {
      closeTileModal();
    }
  };
  window.addEventListener("keydown", keyHandler);
  tileModal._keyHandler = keyHandler; // stash so we can remove it later
  // Blind in Expert mode: show black mask w/ "?"
if (tile.blind) {
  const mask = document.createElement("div");
  mask.style.cssText = "position:absolute; inset:0; background:#000; display:grid; place-items:center; color:#e53935; font:800 42px/1 system-ui;";
  mask.textContent = "?";
  panoEl.appendChild(mask);
  if (freezeOverlay) freezeOverlay.style.display = "none";
  setTimeout(() => guessInput.focus(), 50);
  return;
}
  if (USE_STATIC_IN_VIEWER) {
    // Show a static Street View image (no interaction)
    const img = document.createElement("img");
    img.alt = "";
    img.src = fullscreenURLForTile(tile);
    img.style.cssText = "position:absolute; inset:0; width:100%; height:100%; object-fit:cover;";
    panoEl.appendChild(img);
    if (freezeOverlay) freezeOverlay.style.display = "none";
if (guessInput) setTimeout(() => guessInput.focus(), 50);
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

    // *** INSERT: force wide view and lock to it ***
    const fixedZoom = 0;         // wide FOV (~110–120°)
    pano.setZoom(fixedZoom);

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

// Function to close the tile modal
function closeTileModal() {
  tileModal.classList.add("hidden");

  // remove the key listener if we added it
  if (tileModal._keyHandler) {
    window.removeEventListener("keydown", tileModal._keyHandler);
    delete tileModal._keyHandler;
  }

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

// Set up event listeners when DOM is ready
function initializeTileModal() {
  const tileClose = document.querySelector("#tile-close");
  
  // Close modal when close button is clicked
  tileClose?.addEventListener("click", closeTileModal);
  
  // Close modal when clicking outside the modal body
  tileModal?.addEventListener("click", (e) => { 
    if (e.target === tileModal) closeTileModal(); 
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTileModal);
} else {
  initializeTileModal();
}
