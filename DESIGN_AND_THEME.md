# RSLab — Design System, Theme & Webpage Blueprint

This document outlines the architectural structure, visual identity, typography, and color palettes for the **RSLab** research laboratory webpage.

---

## 1. Visual Identity & Design Philosophy

To ensure the webpage looks **hand-crafted, globally appreciable, and aligned with world-class research labs** (e.g., Stanford HAI, Berkeley BAIR, Max Planck Institute, Oxford VGG):

- **Editorial Clarity**: Strong hierarchy with ample whitespace, clean horizontal rules, and structured grid cards.
- **Academic Restraint**: No generic AI-style neon blob gradients or flashy gimmick animations. Instead, we use crisp borders (`1px solid var(--border)`), subtle surface elevations, and clean monospace metadata badges.
- **Developer & Researcher Friendly**: Clear GitHub badges, license tags, documentation links, and standardized citation/grant acknowledgement blocks.
- **Fully Responsive & Accessible**: Semantic HTML5, accessible contrast ratios (WCAG AAA/AA), mobile-first responsive layout.

---

## 2. Standardized Color Palette (`#91b014` Core Identity)

The lab's standardized brand color is **`#91b014`** (RSLab Olive-Lime Green). To maintain international research lab standards and ensure AAA/AA accessibility across all screens:

```css
:root {
  /* Brand Core */
  --color-primary: #91b014;           /* Official RSLab Brand Green */
  --color-primary-hover: #7d9910;     /* Interactive Hover State */
  --color-primary-dark: #5c720c;      /* High-contrast Text on Light Backgrounds */
  --color-primary-light: #f4f8e5;     /* Soft Badge & Pill Background */
  --color-primary-border: #d4e396;    /* Subtle highlight borders */

  /* Neutrals & Canvas */
  --color-bg: #fbfcf9;                /* Pure clean canvas with subtle warmth */
  --color-surface: #ffffff;           /* Card and module backgrounds */
  --color-surface-alt: #f3f5ee;       /* Secondary containers and tables */
  --color-border: #e2e7dc;            /* Crisp 1px structural dividers */
  --color-border-subtle: #edf1e8;     /* Ultra-fine card inner borders */

  /* Typography */
  --color-text-primary: #131711;      /* Deep forest-charcoal (high readability) */
  --color-text-secondary: #4a5446;    /* Medium neutral body / subtitles */
  --color-text-muted: #737f6f;        /* Metadata, dates, secondary labels */

  /* Dark Elements / Hero Accents */
  --color-dark-surface: #141a12;      /* Deep dark container for footer/code */
  --color-dark-text: #f0f4eb;         /* High-contrast light text on dark */
}
```

### Contrast & Legibility Strategy:
- **Buttons / Actions**: Solid `#91b014` background with `#ffffff` or dark `#131711` bold text depending on button variant.
- **Badges & Tags**: Light tint background (`#f4f8e5`) with dark olive text (`#5c720c`) and border (`#d4e396`) to guarantee crisp legibility.
- **Accents**: 2px top borders on featured cards, active navigation indicators, link underlines, and GitHub metric badges.

---

## 3. Typography Hierarchy

- **Headings Font**: `Plus Jakarta Sans` / `Inter` / system-ui (clean, geometric, authoritative sans-serif).
- **Body Font**: `Inter` / system-ui (maximum legibility at small to medium sizes).
- **Code / Badges / Metrics**: `JetBrains Mono` / `ui-monospace` (precise technical feel for software versions, repositories, citations).

---

## 4. Webpage Content Architecture

The common **RSLab** webpage will be organized into distinct semantic sections:

### 1. Header & Navigation (`<header>`, `<nav>`)
- Lab Wordmark: **RSLab** (with subtitle: *Remote Sensing & Spatial Intelligence Lab* or configurable domain subtitle)
- Fast Navigation Links: *About* · *Research Focus* · *Software Ecosystem* · *Funding & Grants* · *Location & Team*
- Quick Link: Lab GitHub Organization button

### 2. Hero Section (`<section id="hero">`)
- Lab Title & High-level Mission statement
- Institutional Affiliation badge (e.g., University / Research Institute)
- Quick Stats Bar (e.g., `3 Active Open-Source Frameworks`, `100% Open Access`, `Peer-Reviewed & Funded`)

### 3. What is RSLab & What Does It Do? (`<section id="about">`)
- **What is this**: Purpose, identity, and historical mission of RSLab.
- **What does it do**: Core research pillars (e.g., Intelligent Algorithms, Large-scale Processing, Geospatial & Domain Analytics).

### 4. Software Motivation & Open Science Vision (`<section id="motivation">`)
- The gist and underlying motivation of why RSLab builds and maintains open-source software.
- Focus on reproducibility, community-driven scientific research, and real-world deployment.

### 5. What We Have Created: Software Suite (`<section id="software">`)
- A 3-column structured grid highlighting each of the **3 Open-Source Software tools**:
  - **Tool 1**: Name, brief description, version badge, license tag, core capability, GitHub repository link, and a *"Explore Software Webpage →"* placeholder link.
  - **Tool 2**: Name, brief description, version badge, license tag, core capability, GitHub repository link, and a *"Explore Software Webpage →"* placeholder link.
  - **Tool 3**: Name, brief description, version badge, license tag, core capability, GitHub repository link, and a *"Explore Software Webpage →"* placeholder link.

### 6. Learning & Open Data Resources (`<section id="learning">`)
- **Open-source databases & benchmarks**: Multi-spectral benchmark DB, land-cover training corpus (`SQLite`, `GeoParquet`, `HDF5`, `Zarr`).
- **Technical reports & laboratory handbooks**: Applied Remote Sensing & Spatial ML handbook, graduate monograph series (`PDF`).
- **Structured datasets & lookup tables**: Sensor calibration response matrices, atmospheric look-up tables & indices (`.XLSX`, `.CSV`).

### 7. Sponsoring & Funding Agencies (`<section id="funding">`)
- Acknowledgment of national/international research funding bodies, government grants, and industry partners.
- Clean sponsor cards/logos grid with grant identifiers.

### 8. Location & Affiliation (`<section id="location">`)
- **Where is this**: Department, Faculty/Center, University/Institute name, Physical address, campus location details, interactive/clean map card, and primary contact email.

### 8. Footer (`<footer>`)
- Citation guidelines for lab software
- GitHub, ArXiv, ResearchGate, and Email links
- Copyright, Open Source License disclosure, and year

---

## 5. Next Steps
Once we finalize:
1. Palette selection (Option 1, 2, or 3, or custom adjustments).
2. Specific names / details for the 3 software tools (or if placeholder names should be used initially).
3. Specific institutional name and funding agencies.

We will proceed with crafting clean, production-ready, hand-crafted HTML and CSS.
