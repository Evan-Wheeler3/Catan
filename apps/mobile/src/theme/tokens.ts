// Tideholm design tokens. See docs/DESIGN.md for rationale.

export const palette = {
  inkberry: '#2A1F3D',
  lagoon: '#1BA3A0',
  marigold: '#FFB627',
  hibiscus: '#EF476F',
  seaglass: '#E6F2EE',
  fern: '#4F9D52',
} as const;

export interface Theme {
  dark: boolean;
  color: {
    canvas: string;
    surface: string;
    surfaceAlt: string;
    ink: string;
    inkSoft: string;
    inkFaint: string;
    outline: string;
    primary: string;
    onPrimary: string;
    primaryLip: string;
    secondary: string;
    onSecondary: string;
    secondaryLip: string;
    danger: string;
    onDanger: string;
    dangerLip: string;
    success: string;
    ocean: string;
    oceanDeep: string;
    glow: string;
    cardLip: string;
    scrim: string;
  };
}

export const lightTheme: Theme = {
  dark: false,
  color: {
    canvas: palette.seaglass,
    surface: '#FFFFFF',
    surfaceAlt: '#D3E8E1',
    ink: palette.inkberry,
    inkSoft: '#5A4E6E',
    inkFaint: '#8C829C',
    outline: palette.inkberry,
    primary: palette.marigold,
    onPrimary: palette.inkberry,
    primaryLip: '#C7871A',
    secondary: palette.lagoon,
    onSecondary: '#FFFFFF',
    secondaryLip: '#137673',
    danger: palette.hibiscus,
    onDanger: '#FFFFFF',
    dangerLip: '#B32E50',
    success: palette.fern,
    ocean: '#1BA3A0',
    oceanDeep: '#0E7C86',
    glow: palette.marigold,
    cardLip: '#B9D6CD',
    scrim: 'rgba(42,31,61,0.45)',
  },
};

export const darkTheme: Theme = {
  dark: true,
  color: {
    canvas: '#17111F',
    surface: '#241B33',
    surfaceAlt: '#30254A',
    ink: '#F1ECF7',
    inkSoft: '#C5BBD6',
    inkFaint: '#8F84A3',
    outline: '#0D0913',
    primary: '#FFC24D',
    onPrimary: palette.inkberry,
    primaryLip: '#B9801A',
    secondary: '#2BC2BE',
    onSecondary: '#0D0913',
    secondaryLip: '#18807D',
    danger: '#FF6B8E',
    onDanger: '#1A0E14',
    dangerLip: '#B3405E',
    success: '#6CC070',
    ocean: '#126F7A',
    oceanDeep: '#0A4A57',
    glow: '#FFC24D',
    cardLip: '#120D19',
    scrim: 'rgba(0,0,0,0.55)',
  },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { chip: 10, card: 18, sheet: 28, pill: 999 } as const;
export const lip = { rest: 4, pressed: 1 } as const;

export const fonts = {
  display: 'LilitaOne_400Regular',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: 0.5 },
  heading: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: 0.3 },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, letterSpacing: 0.2 },
  number: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
} as const;

/** Board-only terrain tints: [light stop, base, dark stop]. */
export const terrainColors = {
  grove: ['#4FA06C', '#2F7D4F', '#1F5C39'],
  claypit: ['#E08A5C', '#C66A3D', '#9C4D27'],
  meadow: ['#B4E37E', '#93CF5F', '#6FAE41'],
  fields: ['#F7D873', '#EAC14B', '#C99D2A'],
  crags: ['#A4ACBD', '#7F889B', '#5E6678'],
  dunes: ['#F3E4BC', '#E7D3A1', '#CDB57C'],
} as const;

/** Color-blind-safe seat colors (Okabe–Ito derived) + crest shape + roof pattern. */
export const seatStyles = [
  { name: 'Ember', color: '#D55E00', light: '#F08A3E', ink: '#FFFFFF', crest: 'circle', pattern: 'solid' },
  { name: 'Tide', color: '#0072B2', light: '#3A9AD6', ink: '#FFFFFF', crest: 'triangle', pattern: 'stripes' },
  { name: 'Orchid', color: '#CC79A7', light: '#E3A3C6', ink: '#2A1F3D', crest: 'square', pattern: 'dots' },
  { name: 'Chalk', color: '#F2EFE6', light: '#FFFFFF', ink: '#2A1F3D', crest: 'diamond', pattern: 'checks' },
] as const;

export type SeatStyle = (typeof seatStyles)[number];

export const resourceColors = {
  timber: '#2F7D4F',
  clay: '#C66A3D',
  fleece: '#93CF5F',
  grain: '#EAC14B',
  stone: '#7F889B',
} as const;
