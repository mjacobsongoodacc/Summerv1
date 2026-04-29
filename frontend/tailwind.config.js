/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        preview: {
          bg: "#1E1E1E",
          chrome: "#2A2A2A",
          chromeBorder: "#3A3A3A",
          sidebar: "#252525",
          text: "#E8E8E8",
          textDim: "#9A9A9A",
          docBg: "#FFFFFF",
          docText: "#1A1A1A",
          docBorder: "#D0D0D0",
          accent: "#0A84FF",
        },
        cite: {
          risk: "#E55E5E",
          financial: "#5EB3E5",
          debt: "#E5A85E",
          fcf: "#7AB87A",
          sbc: "#A878C8",
          insurance: "#5AC8FA",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
