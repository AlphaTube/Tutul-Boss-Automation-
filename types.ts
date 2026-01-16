
export interface ProcessingStep {
  id: string;
  label: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  description?: string;
}

export interface TranscriptLine {
  original: string;
  rewritten: string;
  speaker?: 'Speaker 1' | 'Speaker 2';
}

export interface TitleSuggestion {
  english: string;
  local: string;
}

export enum VoiceName {
  AOEDE = 'Aoede',
  CHARON = 'Charon',
  EOS = 'Eos',
  FENRIR = 'Fenrir',
  KORE = 'Kore',
  ORPHEUS = 'Orpheus',
  PUCK = 'Puck',
  ZEPHYR = 'Zephyr'
}

export enum TargetLanguage {
  NATIVE = 'Native (Optimization)',
  ARABIC = 'Arabic',
  BANGLA = 'Bangla',
  ENGLISH_USA = 'English (USA)',
  ENGLISH_UK = 'English (UK)',
  HINDI = 'Hindi',
  SPANISH = 'Spanish',
  FRENCH = 'French'
}

export enum ScriptStyle {
  SERIOUS = 'Serious & Professional',
  ROMANTIC = 'Romantic & Soft',
  LOVE = 'Emotional Love',
  COMEDY = 'Funny & Energetic',
  DRAMATIC = 'Dramatic & Intense',
  DOCUMENTARY = 'Documentary Style'
}

export enum AppMode {
  VIDEO = 'Video Mode',
  AI_GEN = 'AI Generator Mode'
}
