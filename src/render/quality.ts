import { loadQuality, saveQuality, type KeyValueStore } from '../platform/storage';

/** Rendering quality tier. Picked once at load (antialiasing is fixed when the renderer is created). */
export type QualityName = 'low' | 'medium' | 'high';

export interface QualitySettings {
  name: QualityName;
  /** Upper bound for the renderer's pixel ratio. */
  pixelRatioCap: number;
  antialias: boolean;
  /** Translucent discs under the characters. */
  blobShadows: boolean;
  /** Distance fog (it also carries the sniff-mode atmosphere). */
  fog: boolean;
  /** Multiplier for radial segment counts on the world props. */
  detail: number;
}

/**
 * The tiers. High matches the original look on desktop. Prop placement is not
 * part of a tier: obstacles come from the seeded sim world, so thinning the
 * visible props would put invisible walls on the field and give devices
 * different layouts for one seed.
 */
export const QUALITY_TIERS: Readonly<Record<QualityName, QualitySettings>> = {
  low: {
    name: 'low',
    pixelRatioCap: 1,
    antialias: false,
    blobShadows: false,
    fog: false,
    detail: 0.5,
  },
  medium: {
    name: 'medium',
    pixelRatioCap: 1.25,
    antialias: false,
    blobShadows: true,
    fog: true,
    detail: 0.75,
  },
  high: {
    name: 'high',
    pixelRatioCap: 1.5,
    antialias: true,
    blobShadows: true,
    fog: true,
    detail: 1,
  },
};

export function parseQuality(raw: string | null): QualityName | null {
  return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : null;
}

/** What the heuristic looks at. */
export interface QualityEnv {
  touch: boolean;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
}

/** Shorter viewport side below which a touch device counts as a phone. */
const PHONE_SHORT_SIDE = 600;

/** Touch devices with a small screen start on medium; everything else on high. */
export function defaultQuality(env: QualityEnv): QualityName {
  return env.touch && Math.min(env.width, env.height) < PHONE_SHORT_SIDE ? 'medium' : 'high';
}

/** Radial segment count scaled by the tier's detail, never below a triangle. */
export function segments(n: number, detail: number): number {
  return Math.max(3, Math.round(n * detail));
}

/**
 * Chooses the tier: `?quality=low|medium|high` wins and is saved, then the
 * saved choice, then the heuristic.
 */
export function resolveQuality(
  search: string,
  store: KeyValueStore,
  env: QualityEnv,
): QualitySettings {
  const fromUrl = parseQuality(new URLSearchParams(search).get('quality'));
  if (fromUrl) {
    saveQuality(store, fromUrl);
    return QUALITY_TIERS[fromUrl];
  }
  const saved = parseQuality(loadQuality(store));
  return QUALITY_TIERS[saved ?? defaultQuality(env)];
}
