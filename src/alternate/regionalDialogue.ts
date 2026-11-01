/** A recorded line is matched by both ID and locale; no other world's voice
 * is a suitable fallback. Keep original speech alongside readable subtitles. */
export interface RegionalLine {
  id: string;
  speaker: string;
  locale: "ja-JP" | "zh-CN";
  text: string;
  translation: string;
}

export interface DistrictSoundscape {
  update(x: number, z: number, dt: number): void;
  dispose(): void;
  playDialogue?(line: RegionalLine): void;
}

export function caption(line: RegionalLine): string {
  return `${line.speaker}: ${line.text}\n${line.translation}`;
}

export function regionalLine(id: string, speaker: string, locale: RegionalLine["locale"], text: string, translation: string): RegionalLine {
  return { id, speaker, locale, text, translation };
}
