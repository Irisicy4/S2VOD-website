# S²VOD project page

Static project page for **Self-Supervised Visual On-Policy Distillation** (S²VOD).
Plain HTML/CSS/JS, no build step — deployable to GitHub Pages as-is (serve this
directory as the site root).

## Layout

- `index.html` — the whole page (hero, interactive figure, abstract, method, results, BibTeX).
- `static/css/style.css` — styling.
- `static/js/figure.js` — interactive-figure tooltips/popups + BibTeX copy button.
- `static/images/figure.svg` — vector render of the architecture figure
  (from `svm_uopsd_figure_v8_cat.pptx` → PDF → `pdftocairo -svg`).
- `static/images/*.png` — rasterized paper figures (`pdftoppm -png -r 200`).

## Interactive figure wiring

The figure is `figure.svg` shown as an `<img>`, with an absolutely-positioned
transparent `<svg>` overlay (same `viewBox`, `0 0 681.76 358.99` = the PDF's
point coordinates) holding the hover regions. `figure.js` wires any element
inside `#arch-figure` carrying:

- `data-aug="<key>"` — tooltip with that augmentation's definition (Table 1 + §3);
- `data-family="<key>"` — tooltip with the family definition + isolated-family result;
- `data-tip="<key>"` — plain informational tooltip;
- `data-ablation="ema|jsd|component"` — popup rendering the matching ablation
  table, cloned live from the Results section (`#table-ema`, `#table-alpha`,
  `#table-component`), so figure and section never drift apart.

To update the figure: re-export the pptx to PDF, run `pdftocairo -svg`, replace
`figure.svg`, and adjust overlay rect coordinates in `index.html` if elements
moved (coordinates can be recovered with PyMuPDF `page.get_text("words")`).

## Tables

The results tables are generated from the paper source (`neurips_2026.tex`) by
`gen_tables.py` (kept in the session scratchpad; regenerate by parsing the
`tab:fv`, `tab:main`, `tab:component`, `tab:ema`, `tab:alpha` tables). Cell
shading reproduces the paper's `cellblue!N` heat-map as
`rgba(157,195,230, N/100)`.

## TODO

- [ ] Paper / arXiv / Code button links (currently "soon" placeholders).
- [ ] Institution logo assets for the hero strip.
- [ ] Final BibTeX (arXiv id).
