const path = require("path");

module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        serif: ['"Fraunces"', '"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
        sans: ['Manrope', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Fraunces"', '"Cormorant Garamond"', "serif"],
        editorial: ['"Cormorant Garamond"', "serif"],
        devanagari: ['"Tiro Devanagari Sanskrit"', '"Noto Serif Devanagari"', "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Foundation */
        violet_deep: "#4f2ea8",
        indigo_night: "#0d0620",
        gold: "#c99a2e",
        gold_light: "#e8b93e",
        /* Warm accents */
        saffron: "#f57316",
        marigold: "#e6a418",
        vermilion: "#dc3f24",
        kumkum: "#b0244b",
        magenta: "#c02679",
        peacock: "#0f5b56",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in-up": { "0%": { opacity: 0, transform: "translateY(14px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "float": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        "glow": { "0%,100%": { boxShadow: "0 0 0 rgba(201,154,46,0)" }, "50%": { boxShadow: "0 0 24px rgba(201,154,46,0.45)" } },
        "shimmer": { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2.4s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
