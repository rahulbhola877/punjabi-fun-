declare const __MUSIC_TRACKS__: string[];
/** Generated from the optional recordings actually present in public/audio/music. */
const tracks = new Set<string>(typeof __MUSIC_TRACKS__ === "undefined" ? [] : __MUSIC_TRACKS__);
export const hasRecordedMusic = (name: string): boolean => tracks.has(name);
