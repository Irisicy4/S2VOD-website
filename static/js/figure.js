/* S2VOD interactive architecture figure.
 *
 * Wiring model (survives figure replacement): any element inside #arch-figure with
 *   data-aug="<key>"      -> hover tooltip with that augmentation's definition
 *   data-family="<key>"   -> hover tooltip with the family definition + isolated result
 *   data-tip="<key>"      -> plain informational tooltip
 *   data-ablation="<key>" -> hover popup rendering the corresponding ablation table
 * The popup pulls its table HTML from the matching element in the Results section
 * (ids: table-component, table-ema, table-alpha), so figure and section stay in sync.
 */

(function () {
  "use strict";

  var FAMILY_COLORS = {
    "info": "#d7e5f2",
    "geometric": "#dcefdd",
    "photometric": "#e4def0",
    "occlusion": "#f8e8d2"
  };
  var FAMILY_NAMES = {
    "info": "Information reduction",
    "geometric": "Geometric",
    "photometric": "Photometric",
    "occlusion": "Occlusion"
  };

  /* Definitions from Table 1 (augmentation space) and Section 3 of the paper. */
  var AUG_DEFS = {
    downscale: {
      name: "Downscale",
      family: "info",
      def: "Downsamples the image without resizing it back, so the student sees fewer pixels and fewer visual tokens while spatial layout is preserved. Part of the champion recipe (applied to every sample), and also the strongest single operator.",
      strength: "scale s ~ U(0.3, 0.6); variants 0.4–0.7 and 0.25–0.5; 3-tier bands [0.2,0.35] / [0.35,0.5] / [0.5,0.75]"
    },
    noise: {
      name: "Gaussian noise",
      family: "info",
      def: "Additive noise via a DDPM forward step, lowering the signal-to-noise ratio with negligible signal attenuation. The second half of the champion recipe, applied on top of downscaling.",
      strength: "DDPM step 200 (σ ≈ 0.11), applied with probability ρ = 0.5"
    },
    blur: {
      name: "Gaussian blur",
      family: "info",
      def: "Soft low-pass filtering that removes high-frequency detail while preserving layout. Follows the same inverted-U as downscaling: 74.20 → 75.71 → 75.07 for light / mid / heavy radii.",
      strength: "radius U(0.5,1.5) / U(1.5,3.0) / U(3.0,6.0)"
    },
    bandstop: {
      name: "Spectral band-stop",
      family: "info",
      def: "Removes an annulus of the 2D frequency spectrum via an FFT band-stop filter — a frequency-domain way of withholding detail.",
      strength: "inner radius 0.15–0.35, width 0.15–0.3"
    },
    pixelation: {
      name: "Local pixelation",
      family: "info",
      def: "Piecewise-constant low-pass: mosaic patches replace local regions with their mean color, removing fine detail only where applied.",
      strength: "application probability ρ = 0.4"
    },
    tokendrop: {
      name: "Visual-token drop",
      family: "info",
      def: "Drops a fraction of vision-encoder tokens while surviving tokens keep native fidelity and true positional encodings — information reduction at the token level rather than the pixel level.",
      strength: "drop 15% / 30% / 50%"
    },
    rotation: {
      name: "Rotation",
      family: "geometric",
      def: "Rotates the frame. Like all geometric operators, it can change the answer to spatially grounded questions by moving objects relative to the image frame.",
      strength: "up to ±35°"
    },
    translation: {
      name: "Translation",
      family: "geometric",
      def: "Shifts the frame, moving content relative to the image borders.",
      strength: "up to 15% of the side length"
    },
    crop: {
      name: "Crop & Zoom",
      family: "geometric",
      def: "Removes peripheral context — and sometimes the question target itself. The cautionary case: its teacher–student gap grows with strength, but performance falls monotonically (71.53 → 68.76 → 67.44) because the gap stops being task-consistent.",
      strength: "minimum scale 0.7 / 0.5 / 0.3"
    },
    zoomout: {
      name: "Zoom-out",
      family: "geometric",
      def: "Shrinks the whole scene onto a padded canvas at a random position, reducing the effective resolution of everything while keeping it all visible.",
      strength: "scale U(0.4, 0.8)"
    },
    brightness: {
      name: "Brightness",
      family: "photometric",
      def: "Brightness jitter — appearance changes while geometry and content are untouched.",
      strength: "factor 0.5–1.5, ρ = 0.8"
    },
    contrast: {
      name: "Contrast",
      family: "photometric",
      def: "Contrast jitter — appearance changes while geometry and content are untouched.",
      strength: "factor 0.5–1.8, ρ = 0.8"
    },
    saturation: {
      name: "Saturation",
      family: "photometric",
      def: "Saturation jitter — appearance changes while geometry and content are untouched.",
      strength: "factor 0.2–1.8, ρ = 0.8"
    },
    photometric: {
      name: "Heavy photometric",
      family: "photometric",
      def: "Adds hue, gamma, and sharpness jitter on top of the colour-jitter base.",
      strength: "hue ±0.15; gamma 0.6–1.6; sharpness 0.2–2.5; ρ = 0.5 each"
    },
    occlusion: {
      name: "Occlusion",
      family: "occlusion",
      def: "Random erasing (grey or noise fill) and GridMask delete localized regions while leaving the rest untouched — distinguished from information reduction by spatial locality.",
      strength: "≤3 patches of 5–30% area, or lattice period 0.1–0.3 with keep ratio 0.5–0.7"
    }
  };

  var FAMILY_DEFS = {
    info: {
      name: "Information reduction",
      def: "Reduces usable visual information while preserving spatial layout: downscaling, blur, pixelation, spectral band-stop, Gaussian noise, visual-token dropping. The strongest family in isolation — 75.65 avg — and the source of the champion recipe."
    },
    geometric: {
      name: "Geometric",
      def: "Modifies spatial organization: rotation, translation, cropping, zoom-out. 74.30 avg in isolation, but the only family that can change the answer to spatially grounded questions — aggressive cropping makes the gap task-inconsistent."
    },
    photometric: {
      name: "Photometric",
      def: "Modifies appearance while preserving geometry and content: brightness, contrast, saturation, hue, gamma, sharpness, equalization. 74.40 avg in isolation."
    },
    occlusion: {
      name: "Occlusion",
      def: "Removes localized regions while leaving the remainder unchanged: random erasing, GridMask, filled crops. 72.44 avg in isolation — every family beats both the base model (70.58) and symmetric self-distillation (65.21)."
    }
  };

  var TIPS = {
    student: {
      name: "Student policy πθ",
      def: "Generates n = 8 rollouts per prompt conditioned on the augmented view x̃ = T(x). Practical bonus: lower-resolution student inputs make both rollouts and forward passes cheaper."
    },
    cleanview: {
      name: "Clean view, same question",
      def: "Teacher and student receive the identical question and the identical on-policy prefix — the only difference between them is what version of the image they see."
    }
  };

  var ABLATIONS = {
    component: {
      title: "Component ablation (Table 4)",
      note: "Removing the view asymmetry (w/o Aug.) collapses the gain to base level; freezing the teacher (w/o EMA) costs only 0.40 — the supervision comes more from the constructed asymmetry than from teacher self-improvement.",
      source: "table-component",
      anchor: "#ablations"
    },
    ema: {
      title: "Teacher update rate (Table 5)",
      note: "The EMA teacher: φ ← (1−η)φ + ηθ. Across decay values 0.95–0.999 the six-benchmark average stays within 0.8% with no monotonic trend — EMA is a stable implementation choice; the essential supervision comes from the constructed view asymmetry.",
      source: "table-ema",
      anchor: "#ablations"
    },
    jsd: {
      title: "Divergence choice (Table 6)",
      note: "Generalized JSD (α = 0.5) beats both one-sided KLs: forward KL is too coverage-seeking, forcing the student toward detail unavailable in its degraded view; reverse KL is too mode-seeking, discarding softer corrective signals. JSD balances coverage and selectivity.",
      source: "table-alpha",
      anchor: "#ablations"
    }
  };

  /* ---------------- machinery ---------------- */

  var fig = document.getElementById("arch-figure");
  if (!fig) return;

  var tooltip = document.createElement("div");
  tooltip.id = "fig-tooltip";
  fig.appendChild(tooltip);

  var popup = document.createElement("div");
  popup.id = "fig-popup";
  fig.appendChild(popup);

  var hideTimer = null;
  var activeEl = null;

  function clearActive() {
    if (activeEl) { activeEl.classList.remove("active"); activeEl = null; }
  }

  function place(box, target, prefer) {
    /* Position `box` near `target` inside the figure wrapper, clamped to it. */
    var wrap = fig.getBoundingClientRect();
    var r = target.getBoundingClientRect();
    box.style.left = "0px"; box.style.top = "0px"; /* reset before measuring */
    var bw = box.offsetWidth, bh = box.offsetHeight;
    var x = r.left - wrap.left + r.width / 2 - bw / 2;
    x = Math.max(6, Math.min(x, wrap.width - bw - 6));
    var y;
    if (prefer === "above" && r.top - wrap.top - bh - 10 > 0) {
      y = r.top - wrap.top - bh - 10;
    } else {
      y = r.bottom - wrap.top + 10;
      if (y + bh > wrap.height + 40) y = Math.max(6, r.top - wrap.top - bh - 10);
    }
    box.style.left = x + "px";
    box.style.top = y + "px";
  }

  function showTooltip(el, html, prefer) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    popup.classList.remove("show");
    tooltip.innerHTML = html;
    tooltip.classList.add("show");
    place(tooltip, el, prefer);
    clearActive();
    activeEl = el; el.classList.add("active");
  }

  function showPopup(el, key) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    var ab = ABLATIONS[key];
    if (!ab) return;
    tooltip.classList.remove("show");
    var src = document.getElementById(ab.source);
    var tableHtml = src ? src.outerHTML.replace(/id="[^"]*"/, "") : "";
    popup.innerHTML =
      '<div class="popup-title">' + ab.title + "</div>" +
      '<div class="popup-note">' + ab.note + "</div>" +
      '<div class="table-scroll">' + tableHtml + "</div>";
    popup.classList.add("show");
    place(popup, el, "below");
    clearActive();
    activeEl = el; el.classList.add("active");
  }

  function scheduleHide() {
    hideTimer = setTimeout(function () {
      tooltip.classList.remove("show");
      popup.classList.remove("show");
      clearActive();
    }, 140);
  }

  function tooltipHtml(d, famKey) {
    var fam = famKey ? '<span class="tt-family" style="background:' + FAMILY_COLORS[famKey] + '">' +
      FAMILY_NAMES[famKey] + "</span>" : "";
    return '<span class="tt-name">' + d.name + "</span>" + fam +
      '<div class="tt-def">' + d.def + "</div>" +
      (d.strength ? '<div class="tt-strength">Strength: ' + d.strength + "</div>" : "");
  }

  fig.querySelectorAll("[data-aug],[data-family],[data-tip],[data-ablation]").forEach(function (el) {
    el.classList.add("hoverable");

    function activate() {
      var k;
      if ((k = el.getAttribute("data-aug")) && AUG_DEFS[k]) {
        showTooltip(el, tooltipHtml(AUG_DEFS[k], AUG_DEFS[k].family), "above");
      } else if ((k = el.getAttribute("data-family")) && FAMILY_DEFS[k]) {
        showTooltip(el, tooltipHtml(FAMILY_DEFS[k], k), "below");
      } else if ((k = el.getAttribute("data-tip")) && TIPS[k]) {
        showTooltip(el, tooltipHtml(TIPS[k]), "below");
      } else if ((k = el.getAttribute("data-ablation"))) {
        showPopup(el, k);
      }
    }

    el.addEventListener("mouseenter", activate);
    el.addEventListener("mouseleave", scheduleHide);
    el.addEventListener("click", function (e) {
      /* touch support: first tap shows, tap elsewhere hides */
      e.preventDefault();
      if (activeEl === el && (tooltip.classList.contains("show") || popup.classList.contains("show"))) {
        tooltip.classList.remove("show"); popup.classList.remove("show"); clearActive();
      } else {
        activate();
      }
      e.stopPropagation();
    });
  });

  popup.addEventListener("mouseenter", function () {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  });
  popup.addEventListener("mouseleave", scheduleHide);

  document.addEventListener("click", function () {
    tooltip.classList.remove("show");
    popup.classList.remove("show");
    clearActive();
  });

  /* BibTeX copy button */
  var copyBtn = document.getElementById("copy-bibtex");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var pre = document.querySelector("pre.bibtex");
      navigator.clipboard.writeText(pre.textContent.trim()).then(function () {
        copyBtn.textContent = "Copied!";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
      });
    });
  }
})();
