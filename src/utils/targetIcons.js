const iconCache = new Map();

const iconMarkup = {
  airport: `
    <path d="M24 12v24M17 17h14M18 31h12M20 23h8" />
    <path d="m21 12 3-3 3 3M21 36h6" />
  `,
  aircraft: `
    <path fill="white" stroke="none" d="m24 9 3.2 10.2 9.8 5.3v3.3l-10.1-2.4-1.1 7.7 4 3V39L24 37l-5.8 2v-2.9l4-3-1.1-7.7L11 27.8v-3.3l9.8-5.3L24 9Z" />
  `,
  port: `
    <circle cx="24" cy="15" r="3" />
    <path d="M24 18v18M17 23h14M13 29c1.5 5 5.2 8 11 8s9.5-3 11-8M13 29h5M30 29h5" />
  `,
  weather: `
    <circle cx="21" cy="20" r="6" />
    <path d="M21 10v3M21 27v3M11 20h3M28 20h3M14 13l2 2M26 25l2 2M28 13l-2 2" />
    <path d="M17 34h15a5 5 0 0 0 0-10 8 8 0 0 0-14 4 3 3 0 0 0-1 6Z" />
  `,
  hospital: `
    <path fill="white" stroke="none" d="M20 12h8v8h8v8h-8v8h-8v-8h-8v-8h8v-8Z" />
  `,
  warehouse: `
    <path d="m12 21 12-8 12 8v15H12V21Z" />
    <path d="M18 36V25h12v11M18 29h12M18 33h12" />
  `,
  communication: `
    <path d="M24 18v19M19 37h10M21 37l3-19 3 19" />
    <path d="M18 15a8 8 0 0 1 12 0M14 11a14 14 0 0 1 20 0" />
    <circle cx="24" cy="17" r="2" fill="white" />
  `,
  default: `
    <circle cx="24" cy="24" r="8" />
    <path d="M24 10v6M24 32v6M10 24h6M32 24h6" />
  `,
};

function safeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#38bdf8";
}

export function getTargetIcon(categoryId, color) {
  const backgroundColor = safeColor(color);
  const iconType = iconMarkup[categoryId] ? categoryId : "default";
  const cacheKey = `${iconType}:${backgroundColor}`;

  if (!iconCache.has(cacheKey)) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="21" fill="${backgroundColor}" stroke="white" stroke-width="2" />
        <g fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          ${iconMarkup[iconType]}
        </g>
      </svg>
    `;
    iconCache.set(
      cacheKey,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
  }

  return iconCache.get(cacheKey);
}
