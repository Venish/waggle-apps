# Fonts Directory
Place your custom font files (WOFF2, WOFF, TTF, OTF, etc.) in this folder.

## How to use in Next.js

### Method 1: Using next/font/local (Recommended)
```tsx
// src/app/layout.tsx
import localFont from "next/font/local";

const myFont = localFont({
  src: "../../public/fonts/CustomFont.woff2",
  variable: "--font-custom",
});
```

### Method 2: Using @font-face in CSS
```css
/* src/app/globals.css */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/CustomFont.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
```
