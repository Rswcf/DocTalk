// Mock data and frame timing constants for the ProductShowcase animation

export const FPS = 30;
export const TOTAL_FRAMES = 300; // 10s loop

// --- Frame timings ---
export const FRAMES = {
  userMsg: 15,
  dotsStart: 45,
  dotsEnd: 60,
  streamStart: 60,
  streamEnd: 180,
  citationCards: 180,
  citationStagger: 8,
  holdEnd: 270,
  fadeStart: 270,
  fadeEnd: 299,
  // Highlight appearance frames (during streaming)
  highlight1: 105,
  highlight2: 140,
  highlight3: 170,
} as const;

// --- Chat content ---
export const USER_QUESTION =
  "What were NVIDIA's key revenue drivers in FY2024?";

export const AI_RESPONSE =
  "NVIDIA's FY2024 revenue was primarily driven by its Data Center segment, which generated $47.5 billion [1], representing 78% of total revenue. The Gaming segment contributed $10.4 billion [2], while total revenue reached a record $60.9 billion [3], up 126% year-over-year.";

export const CITATIONS = [
  {
    refIndex: 1,
    page: 42,
    snippet: "Data Center revenue was $47.5 billion, up 217% from the prior year...",
    // Highlight position on mock PDF (normalized 0-1)
    bbox: { x: 0.05, y: 0.38, w: 0.9, h: 0.06 },
  },
  {
    refIndex: 2,
    page: 42,
    snippet: "Gaming revenue was $10.4 billion, up 15% from a year ago...",
    bbox: { x: 0.05, y: 0.52, w: 0.9, h: 0.06 },
  },
  {
    refIndex: 3,
    page: 42,
    snippet: "Total revenue for fiscal 2024 was $60.9 billion, an increase of 126%...",
    bbox: { x: 0.05, y: 0.66, w: 0.9, h: 0.06 },
  },
] as const;

// --- Mock PDF text lines ---
export const PDF_TITLE = "NVIDIA Corporation";
export const PDF_SUBTITLE = "Annual Report on Form 10-K — Fiscal Year 2024";
export const PDF_HEADING = "Revenue Discussion and Analysis";

export const PDF_LINES = [
  "Total revenue for fiscal 2024 was $60.9 billion, an increase of 126%",
  "compared to the prior fiscal year, driven by strong demand across our",
  "accelerated computing platforms.",
  "",
  "Data Center revenue was $47.5 billion, up 217% from the prior year,",
  "reflecting broad adoption of the NVIDIA Hopper architecture and",
  "increased demand for AI training and inference workloads.",
  "",
  "Gaming revenue was $10.4 billion, up 15% from a year ago, driven",
  "by the GeForce RTX 40 Series GPUs based on the Ada Lovelace",
  "architecture and continued growth in gaming laptops.",
];

// --- Color palettes ---
export const COLORS = {
  light: {
    bg: "#ffffff",
    panelBg: "#fafafa",       // zinc-50
    cardBg: "#ffffff",
    border: "#e4e4e7",        // zinc-200
    borderLight: "#f4f4f5",   // zinc-100
    textPrimary: "#09090b",   // zinc-950
    textSecondary: "#71717a", // zinc-500
    textMuted: "#a1a1aa",     // zinc-400
    userBubble: "#27272a",    // zinc-800
    userBubbleText: "#ffffff",
    assistantBubble: "#fafafa", // zinc-50
    assistantBubbleText: "#18181b", // zinc-900
    highlightBg: "rgba(251, 191, 36, 0.30)", // amber-400 @ 30%
    toolbarBg: "#f4f4f5",     // zinc-100
    inputBg: "#ffffff",
    chromeTop: "#f4f4f5",
  },
  dark: {
    bg: "#09090b",            // zinc-950
    panelBg: "#18181b",       // zinc-900
    cardBg: "#09090b",        // zinc-950
    border: "#27272a",        // zinc-800
    borderLight: "#3f3f46",   // zinc-700
    textPrimary: "#fafafa",   // zinc-50
    textSecondary: "#71717a", // zinc-500
    textMuted: "#a1a1aa",     // zinc-400
    userBubble: "#3f3f46",    // zinc-700
    userBubbleText: "#ffffff",
    assistantBubble: "#27272a", // zinc-800
    assistantBubbleText: "#e4e4e7", // zinc-200
    highlightBg: "rgba(251, 191, 36, 0.30)",
    toolbarBg: "#27272a",
    inputBg: "#18181b",
    chromeTop: "#27272a",
  },
} as const;
