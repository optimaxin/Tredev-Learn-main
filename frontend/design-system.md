:root {
  /* ==========================================================================
     1. COLOR PALETTE
     ========================================================================== */
  /* Primary & Secondary Brand Colors */
  --color-primary: #131131;          /* Deep cosmic midnight blue */
  --color-primary-light: #1c1947;    /* Lighter navy variant */
  --color-secondary: #c58b2b;        /* Sacred gold / ochre accent */
  --color-secondary-light: #f7e8c4;  /* Soft golden tint */
  
  /* Background Colors */
  --color-bg-page: #faf6ee;           /* Warm cream page background */
  --color-bg-card: #ffffff;           /* Crisp white for elevated cards */
  --color-bg-card-alt: #f4f0e8;       /* Warm beige card tint (e.g., Daily Mantra) */
  --color-bg-modal: #ffffff;          /* Modal dialog container */
  --color-bg-input: #f7f5f0;          /* Subtle warm input fill */
  --color-bg-footer: #0c0a21;         /* Ultra dark midnight footer */

  /* Text Colors */
  --color-text-heading: #131131;      /* Deep midnight blue for headings */
  --color-text-body: #4a4a5a;         /* Muted indigo-gray for readable body text */
  --color-text-muted: #8c8b99;        /* Subtle gray for secondary metadata */
  --color-text-gold: #b37b25;         /* Gold text for sub-headers and tags */
  --color-text-inverse: #ffffff;      /* White text on dark containers */

  /* Borders & Accents */
  --color-border-subtle: #efebe1;     /* Soft warm card/input borders */
  --color-border-gold: #e5c678;       /* Highlighted golden border */
  --color-accent-cta: #e67e22;        /* Vibrant orange CTA / badge focus */
  --color-accent-badge: #f5d178;      /* Warm golden yellow badge */

  /* Gradients */
  --gradient-gold-tag: linear-gradient(135deg, #fceecb 0%, #f5d178 100%);
  --gradient-hero-overlay: radial-gradient(circle, rgba(250, 246, 238, 0.4) 0%, rgba(250, 246, 238, 0.95) 100%);

  /* ==========================================================================
     2. TYPOGRAPHY (Configured with Yatra One & complementary sans-serif)
     ========================================================================== */
  --font-family-display: 'Yatra One', cursive;           /* Front page & main hero headings */
  --font-family-heading: 'Cinzel', 'Yatra One', serif;  /* Secondary section headings */
  --font-family-body: 'Plus Jakarta Sans', sans-serif;   /* Clean modern UI body text */
  --font-family-quote: 'Lora', serif;                     /* Italic quotes & mantras */

  /* Font Sizes */
  --font-size-h1: 3rem;              /* 48px - Main Hero Title */
  --font-size-h2: 2.25rem;           /* 36px - Section Headings */
  --font-size-h3: 1.5rem;            /* 24px - Card & Tool Titles */
  --font-size-body: 1rem;            /* 16px - Standard Paragraph */
  --font-size-small: 0.875rem;       /* 14px - Subtitles, Input Labels */
  --font-size-caption: 0.75rem;      /* 12px - Badges, Metadata Tags */

  /* Font Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;

  /* Letter Spacing */
  --letter-spacing-tight: -0.01em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.05em;     /* For uppercase subheadings */

  /* ==========================================================================
     3. SPACING PATTERNS
     ========================================================================== */
  --spacing-section-py: 5rem;        /* 80px Top/Bottom Section Padding */
  --spacing-card-p: 2rem;            /* 32px Inner Card Padding */
  --spacing-gap-lg: 2rem;            /* 32px Grid/Flex Gap */
  --spacing-gap-md: 1.25rem;         /* 20px Element Gap */
  --spacing-gap-sm: 0.75rem;         /* 12px Tight Inline Gap */

  /* Border Radii */
  --radius-sm: 8px;                  /* Inputs & small buttons */
  --radius-md: 12px;                 /* Standard buttons & badges */
  --radius-lg: 20px;                 /* Main cards & containers */
  --radius-full: 9999px;             /* Pill buttons & search bars */

  /* ==========================================================================
     4. VISUAL EFFECTS
     ========================================================================== */
  --shadow-card: 0 10px 30px rgba(19, 17, 49, 0.05);
  --shadow-button: 0 4px 14px rgba(19, 17, 49, 0.15);
  --shadow-float: 0 12px 32px rgba(0, 0, 0, 0.12);
  --backdrop-blur: blur(8px);
  --opacity-overlay: 0.85;

  /* ==========================================================================
     5. BACKGROUND ARTWORK / PLACEMENT
     ========================================================================== */
  --bg-pattern-page: url('/assets/celestial-temple-bg.png');
  --bg-pattern-position: center top;
  --bg-pattern-repeat: no-repeat;
  --bg-pattern-size: cover;
}