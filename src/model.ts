export type GuideKey = 'thirds' | 'center' | 'diagonal' | 'golden';
export type Phase = 'loading' | 'ready' | 'available' | 'editing' | 'error';
export type StablePhase = Exclude<Phase, 'loading' | 'error'>;
export type ErrorSource = 'initialization' | 'image' | 'save';
export type Ratio = 'free' | '1:1' | '4:5' | '16:9';

export interface ImageAsset {
  src: string;
  width: number;
  height: number;
  name: string;
}

export interface CropVariant {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: string;
}

export interface FrameDocument {
  version: 1;
  image: ImageAsset | null;
  guides: Record<GuideKey, boolean>;
  subject: { x: number; y: number } | null;
  crop: CropVariant;
  variants: CropVariant[];
}

export interface StatusError {
  source: ErrorSource;
  message: string;
}

export interface WorkStatus {
  phase: Phase;
  message: string;
  error: StatusError | null;
  fallbackPhase: StablePhase;
}

export interface ViewState {
  status: WorkStatus;
  document: FrameDocument;
  compareOpen: boolean;
}

export const DEFAULT_CROP: CropVariant = {
  id: 'current',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  ratio: 'free',
};

export const EMPTY_DOCUMENT: FrameDocument = {
  version: 1,
  image: null,
  guides: { thirds: true, center: false, diagonal: false, golden: false },
  subject: null,
  crop: DEFAULT_CROP,
  variants: [],
};
