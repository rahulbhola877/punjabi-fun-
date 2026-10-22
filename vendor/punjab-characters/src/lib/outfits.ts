import type { Archetype } from './rig';

export type TopKind = 'kurta' | 'kameez' | 'shirt' | 'tee' | 'uniform' | 'jersey' | 'chola' | 'choli' | 'hoodie' | 'kurti';
export type HemLen = 'crop' | 'hip' | 'thigh' | 'knee' | 'calf';
export type BottomKind = 'pajama' | 'patiala' | 'salwar' | 'churidar' | 'trousers' | 'jeans' | 'shorts' | 'chadra' | 'lehenga' | 'skirt' | 'leggings';
export type HeadKind = 'dastar' | 'patka' | 'nihang' | 'police' | 'rumal' | 'cap' | 'topi' | 'gandhi' | 'pagri' | 'none';
export type ShoeKind = 'jutti' | 'boots' | 'formal' | 'sneaker' | 'heels' | 'sandal' | 'school';
export type HairStyle = 'braid' | 'bun' | 'loose' | 'pigtails' | 'short' | 'crop' | 'sidepart' | 'balding';
export type OuterKind = 'waistcoat' | 'cardigan' | 'blazer' | 'apron';
export type PropId = 'lathi' | 'briefcase' | 'handbag' | 'stick' | 'cane' | 'ladle' | 'chai' | 'roti' | 'thali' | 'schoolbag' | 'dhol_sticks' | 'phone' | 'tasbih';
export type Extra =
  | 'belt' | 'badge' | 'epaulettes' | 'tie' | 'gatra' | 'necklace' | 'tikka' | 'bangles' | 'earrings'
  | 'chakkar' | 'whistle' | 'sash' | 'choora' | 'medal' | 'hem_trim' | 'nose_pin' | 'bindi' | 'headband'
  | 'tilak' | 'sindoor' | 'mangalsutra' | 'cross' | 'kalava' | 'glasses';

export type Community = 'sikh' | 'hindu' | 'muslim' | 'christian' | 'universal';
export type Facial = 'full' | 'trim' | 'sunnah' | 'stubble' | 'moustache' | 'none';
export const COMMUNITY_LABEL: Record<Community, string> = { sikh: 'Sikh', hindu: 'Hindu', muslim: 'Muslim', christian: 'Christian', universal: 'Everyday / all communities' };
export interface OutfitDef {
  id: string;
  /** community this outfit is typically associated with (drives greeting + UI filter) */
  community?: Community;
  /** male facial hair style (default: full beard + twirled moustache for Sikh headwear, moustache otherwise) */
  facial?: Facial;
  label: string;
  blurb: string;
  for: Archetype[];
  top: { kind: TopKind; color: string; trim?: string; sleeve: number; len: HemLen; tucked?: boolean };
  outer?: { kind: OuterKind; color: string; trim?: string; sleeve?: number; len?: HemLen };
  bottom: { kind: BottomKind; color: string; trim?: string };
  shoes: { kind: ShoeKind; color: string; trim?: string };
  head: { kind: HeadKind; color: string; trim?: string; tail?: boolean };
  dupatta?: { mode: 'shoulders' | 'head' | 'drape' | 'hijab'; color: string; trim: string; wide?: boolean; pattern?: 'phulkari' | 'plain' };
  hair?: HairStyle;
  extras: Extra[];
  props?: { R?: PropId; L?: PropId };
  /** colours that the demo UI lets players tweak */
  tweak?: ('top' | 'bottom' | 'head' | 'dupatta' | 'outer')[];
}

const M: Archetype[] = ['male', 'uncle', 'boy'];
const MA: Archetype[] = ['male', 'uncle'];
const F: Archetype[] = ['female', 'aunty', 'girl'];
const FA: Archetype[] = ['female', 'aunty'];

export const OUTFITS: OutfitDef[] = [
  // ---------------------------------------------------------------- male family
  {
    id: 'kurta_pajama', label: 'Kurta Pajama + Dastar', blurb: 'Everyday Punjabi wear: cream kurta, pajama and a saffron dastar.',
    for: M, top: { kind: 'kurta', color: '#f2ead8', sleeve: 1, len: 'knee' },
    bottom: { kind: 'pajama', color: '#ece4d2' }, shoes: { kind: 'jutti', color: '#8b5a2b', trim: '#e0b23c' },
    head: { kind: 'dastar', color: '#ee8a1c', trim: '#c96a0a' }, extras: ['gatra'], tweak: ['top', 'bottom', 'head'],
  },
  {
    id: 'festive', label: 'Festive Kurta + Nehru Jacket', blurb: 'Wedding / Baisakhi wear with a maroon waistcoat and gold trim.',
    for: M, top: { kind: 'kurta', color: '#f6e7c8', sleeve: 1, len: 'knee' },
    outer: { kind: 'waistcoat', color: '#7d1530', trim: '#e0b23c', len: 'hip', sleeve: 0 },
    bottom: { kind: 'churidar', color: '#f6e7c8' }, shoes: { kind: 'jutti', color: '#6b3a1e', trim: '#e0b23c' },
    head: { kind: 'dastar', color: '#d9a21f', trim: '#a8780f' }, extras: ['medal'], tweak: ['top', 'outer', 'head'],
  },
  {
    id: 'police', label: 'Punjab Police', blurb: 'Khaki uniform, navy dastar with badge, belt, boots and lathi.',
    for: MA, top: { kind: 'uniform', color: '#bba66a', trim: '#2a2a2a', sleeve: 0.9, len: 'hip', tucked: true },
    bottom: { kind: 'trousers', color: '#a99556' }, shoes: { kind: 'boots', color: '#18181a' },
    head: { kind: 'police', color: '#1b2a5c', trim: '#d9b43a' }, extras: ['belt', 'badge', 'epaulettes', 'whistle'], props: { R: 'lathi' }, tweak: ['head'],
  },
  {
    id: 'business', label: 'Businessman', blurb: 'Tailored charcoal suit, white shirt, tie and a matching dastar.',
    for: MA, top: { kind: 'shirt', color: '#f4f4f2', sleeve: 1, len: 'hip', tucked: true },
    outer: { kind: 'blazer', color: '#2b3040', len: 'thigh', sleeve: 1 },
    bottom: { kind: 'trousers', color: '#2b3040' }, shoes: { kind: 'formal', color: '#121212' },
    head: { kind: 'dastar', color: '#7b1d2e', trim: '#5b1220' }, extras: ['tie'], props: { L: 'briefcase' }, tweak: ['outer', 'head'],
  },
  {
    id: 'farmer', label: 'Kisan (Farmer)', blurb: 'White kurta, chadra wrap and a light pagri, the fields of the Majha.',
    for: MA, top: { kind: 'kurta', color: '#efe8d6', sleeve: 1, len: 'thigh' },
    bottom: { kind: 'chadra', color: '#f7f4ea', trim: '#c8392b' }, shoes: { kind: 'jutti', color: '#7a4a24' },
    head: { kind: 'dastar', color: '#f0d56a', trim: '#cfb040' }, extras: [], props: { R: 'stick' }, tweak: ['top', 'bottom', 'head'],
  },
  {
    id: 'bhangra', label: 'Bhangra Performer', blurb: 'Bright kurta, waistcoat, lungi and a pagri with a flowing tail.',
    for: M, top: { kind: 'kurta', color: '#ec2f7a', sleeve: 1, len: 'thigh' },
    outer: { kind: 'waistcoat', color: '#f2b705', trim: '#ffffff', len: 'hip', sleeve: 0 },
    bottom: { kind: 'chadra', color: '#10a8a0', trim: '#f2b705' }, shoes: { kind: 'jutti', color: '#c73a2a', trim: '#f2b705' },
    head: { kind: 'dastar', color: '#f2b705', trim: '#ec2f7a', tail: true }, extras: ['sash'], tweak: ['top', 'outer', 'bottom', 'head'],
  },
  {
    id: 'sewadar', label: 'Gurdwara Sewadar', blurb: 'White kurta pajama with an orange rumal, serving in the langar.',
    for: M, top: { kind: 'kurta', color: '#fbfaf5', sleeve: 1, len: 'knee' },
    bottom: { kind: 'pajama', color: '#f6f4ee' }, shoes: { kind: 'sandal', color: '#6a4a2a' },
    head: { kind: 'rumal', color: '#f28a1c', trim: '#d46d08' }, extras: ['sash'], tweak: ['head'],
  },
  {
    id: 'dhaba', label: 'Dhaba Cook', blurb: 'Orange patka, apron and ladle: butter chicken at midnight on the GT road.',
    for: MA, top: { kind: 'kurta', color: '#cf3f2a', sleeve: 0.7, len: 'thigh' },
    outer: { kind: 'apron', color: '#f4f2ec', trim: '#c8c4b8', len: 'knee', sleeve: 0 },
    bottom: { kind: 'pajama', color: '#2f2f36' }, shoes: { kind: 'sandal', color: '#2a2a2a' },
    head: { kind: 'patka', color: '#f28a1c', trim: '#d46d08' }, extras: [], props: { R: 'ladle' }, tweak: ['top', 'head'],
  },
  {
    id: 'student', label: 'College Student', blurb: 'Hoodie, jeans, sneakers and a coloured patka: Ludhiana campus style.',
    for: ['male', 'boy'], top: { kind: 'hoodie', color: '#2f78d0', trim: '#ffffff', sleeve: 1, len: 'hip' },
    bottom: { kind: 'jeans', color: '#34496e' }, shoes: { kind: 'sneaker', color: '#f1f1f1', trim: '#e23a2d' },
    head: { kind: 'patka', color: '#1b1b24', trim: '#000000' }, extras: [], props: { L: 'schoolbag' }, tweak: ['top', 'bottom', 'head'],
  },
  {
    id: 'school', label: 'School Uniform', blurb: 'White shirt, navy shorts, red tie and a navy patka.',
    for: ['boy'], top: { kind: 'shirt', color: '#f6f6f4', sleeve: 0.45, len: 'hip', tucked: true },
    bottom: { kind: 'shorts', color: '#1d2d5c' }, shoes: { kind: 'school', color: '#16161a' },
    head: { kind: 'patka', color: '#1d2d5c', trim: '#101a3a' }, extras: ['tie'], props: { L: 'schoolbag' }, tweak: ['bottom', 'head'],
  },
  {
    id: 'kabaddi', label: 'Kabaddi Player', blurb: 'Team jersey, shorts and a yellow patka for the village tournament.',
    for: ['male', 'boy'], top: { kind: 'jersey', color: '#e0332e', trim: '#ffd400', sleeve: 0.2, len: 'hip' },
    bottom: { kind: 'shorts', color: '#17171c' }, shoes: { kind: 'sneaker', color: '#f1f1f1', trim: '#111111' },
    head: { kind: 'patka', color: '#ffd400', trim: '#d9b300' }, extras: ['headband'], tweak: ['top', 'bottom', 'head'],
  },
  {
    id: 'nihang', label: 'Nihang Singh', blurb: 'Traditional blue chola, tall dumala with chakkar, for Hola Mohalla.',
    for: MA, top: { kind: 'chola', color: '#1f3f9c', trim: '#f2a007', sleeve: 1, len: 'calf' },
    bottom: { kind: 'pajama', color: '#1f3f9c' }, shoes: { kind: 'jutti', color: '#5a3a1e' },
    head: { kind: 'nihang', color: '#1f3f9c', trim: '#f2a007' }, extras: ['gatra', 'chakkar', 'sash'], tweak: ['top', 'head'],
  },
  {
    id: 'winter_uncle', label: 'Winter Uncle (Sweater + Shawl)', blurb: 'Woolen cardigan, shawl and a cane for the Amritsar winter morning.',
    for: MA, top: { kind: 'kurta', color: '#ddd5c0', sleeve: 1, len: 'knee' },
    outer: { kind: 'cardigan', color: '#6b4a2b', trim: '#4a3220', len: 'thigh', sleeve: 1 },
    bottom: { kind: 'pajama', color: '#c9c1ae' }, shoes: { kind: 'jutti', color: '#4a3220' },
    head: { kind: 'dastar', color: '#f2efe6', trim: '#d6d1c3' }, dupatta: { mode: 'shoulders', color: '#8a3b2a', trim: '#d9a21f', wide: true, pattern: 'plain' },
    extras: [], props: { R: 'cane' }, tweak: ['outer', 'head', 'dupatta'],
  },
  // -------------------------------------------------------------- female family
  {
    id: 'patiala_suit', label: 'Patiala Salwar Suit', blurb: 'Fuchsia kameez, yellow Patiala salwar and a phulkari dupatta.',
    for: F, top: { kind: 'kameez', color: '#e0306f', trim: '#f2b705', sleeve: 0.75, len: 'knee' },
    bottom: { kind: 'patiala', color: '#f2b705' }, shoes: { kind: 'jutti', color: '#c8392b', trim: '#f2d36a' },
    head: { kind: 'none', color: '#000000' }, dupatta: { mode: 'shoulders', color: '#f08a1c', trim: '#e0306f', pattern: 'phulkari' },
    hair: 'braid', extras: ['earrings', 'bangles', 'tikka', 'hem_trim'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'giddha', label: 'Giddha Performer', blurb: 'Bright green suit, red phulkari and a paranda-tipped braid.',
    for: ['female', 'girl'], top: { kind: 'kameez', color: '#17a05a', trim: '#f2b705', sleeve: 0.45, len: 'knee' },
    bottom: { kind: 'patiala', color: '#d6222f' }, shoes: { kind: 'jutti', color: '#f2b705', trim: '#d6222f' },
    head: { kind: 'none', color: '#000000' }, dupatta: { mode: 'drape', color: '#e11d48', trim: '#f2b705', pattern: 'phulkari' },
    hair: 'braid', extras: ['earrings', 'bangles', 'tikka', 'necklace', 'hem_trim', 'nose_pin'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'police_f', label: 'Punjab Police (Woman)', blurb: 'Khaki uniform, peaked cap, belt and baton.',
    for: ['female'], top: { kind: 'uniform', color: '#bba66a', trim: '#2a2a2a', sleeve: 0.9, len: 'hip', tucked: true },
    bottom: { kind: 'trousers', color: '#a99556' }, shoes: { kind: 'boots', color: '#18181a' },
    head: { kind: 'cap', color: '#1b2a5c', trim: '#d9b43a' }, hair: 'bun', extras: ['belt', 'badge', 'epaulettes', 'whistle'], props: { R: 'lathi' }, tweak: ['head'],
  },
  {
    id: 'business_f', label: 'Businesswoman', blurb: 'Plum blazer, cream blouse, trousers and heels.',
    for: ['female'], top: { kind: 'shirt', color: '#f6efe2', sleeve: 1, len: 'hip', tucked: true },
    outer: { kind: 'blazer', color: '#5a2a4f', len: 'thigh', sleeve: 1 },
    bottom: { kind: 'trousers', color: '#3a2a3c' }, shoes: { kind: 'heels', color: '#1c1c1c' },
    head: { kind: 'none', color: '#000' }, hair: 'bun', extras: ['earrings'], props: { L: 'handbag' }, tweak: ['outer'],
  },
  {
    id: 'college_f', label: 'College Girl', blurb: 'Yellow kurti, jeans, sneakers and a ponytail braid.',
    for: ['female', 'girl'], top: { kind: 'kurti', color: '#f4b81f', trim: '#ffffff', sleeve: 0.5, len: 'thigh' },
    bottom: { kind: 'jeans', color: '#3a5c92' }, shoes: { kind: 'sneaker', color: '#ffffff', trim: '#e0306f' },
    head: { kind: 'none', color: '#000' }, hair: 'braid', extras: ['earrings'], props: { L: 'schoolbag' }, tweak: ['top', 'bottom'],
  },
  {
    id: 'school_f', label: 'School Uniform (Girl)', blurb: 'White kameez, navy salwar and a navy dupatta with two plaits.',
    for: ['girl'], top: { kind: 'kameez', color: '#f6f6f4', trim: '#1d2d5c', sleeve: 0.5, len: 'knee' },
    bottom: { kind: 'salwar', color: '#1d2d5c' }, shoes: { kind: 'school', color: '#16161a' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'shoulders', color: '#1d2d5c', trim: '#1d2d5c', pattern: 'plain' },
    hair: 'pigtails', extras: [], props: { L: 'schoolbag' }, tweak: ['bottom', 'dupatta'],
  },
  {
    id: 'village_f', label: 'Village Lady (Chunni on head)', blurb: 'Soft cotton suit with the chunni draped over the head.',
    for: F, top: { kind: 'kameez', color: '#4f9a86', trim: '#f0d88a', sleeve: 1, len: 'knee' },
    bottom: { kind: 'salwar', color: '#e9e0cc' }, shoes: { kind: 'jutti', color: '#7a4a24', trim: '#e0b23c' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'head', color: '#c9553d', trim: '#f0d88a', pattern: 'phulkari' },
    hair: 'braid', extras: ['earrings', 'bangles'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'bridal', label: 'Punjabi Bride', blurb: 'Red lehenga, gold dupatta over the head, choora and maang tikka.',
    for: ['female'], top: { kind: 'choli', color: '#c4122f', trim: '#e8b93c', sleeve: 0.5, len: 'crop' },
    bottom: { kind: 'lehenga', color: '#c4122f', trim: '#e8b93c' }, shoes: { kind: 'jutti', color: '#e8b93c', trim: '#c4122f' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'head', color: '#d8223d', trim: '#e8b93c', pattern: 'phulkari' },
    hair: 'braid', extras: ['choora', 'tikka', 'necklace', 'earrings', 'nose_pin', 'hem_trim'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'winter_aunty', label: 'Winter Aunty (Cardigan)', blurb: 'Sage suit, woolen cardigan and a cream chunni over the head.',
    for: FA, top: { kind: 'kameez', color: '#6f9a7b', trim: '#e8d9a8', sleeve: 1, len: 'knee' },
    outer: { kind: 'cardigan', color: '#8a5a3a', trim: '#5a3a24', len: 'thigh', sleeve: 1 },
    bottom: { kind: 'salwar', color: '#d9d2c0' }, shoes: { kind: 'sandal', color: '#5a3a24' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'head', color: '#ece3cf', trim: '#c8b68a', pattern: 'plain' },
    hair: 'bun', extras: ['earrings', 'bangles'], tweak: ['top', 'outer', 'dupatta'],
  },
  {
    id: 'sewadar_f', label: 'Gurdwara Sewadar (Woman)', blurb: 'White suit with a saffron chunni, serving in the langar hall.',
    for: F, top: { kind: 'kameez', color: '#fbfaf5', trim: '#f28a1c', sleeve: 0.9, len: 'knee' },
    bottom: { kind: 'salwar', color: '#f6f4ee' }, shoes: { kind: 'sandal', color: '#6a4a2a' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'head', color: '#f28a1c', trim: '#d46d08', pattern: 'plain' },
    hair: 'braid', extras: ['bangles'], tweak: ['dupatta'],
  },
];


// ---------------------------------------------------------------------------------------------
// Non-Sikh and mixed-community outfits (Punjab is home to Hindu, Muslim, Christian and Sikh families)
// ---------------------------------------------------------------------------------------------
const policeBase = OUTFITS.find((o) => o.id === 'police')!;
const schoolBase = OUTFITS.find((o) => o.id === 'school')!;
OUTFITS.push(
  // ---- men / uncles / boys
  {
    id: 'diwali_kurta', community: 'hindu', facial: 'moustache', label: 'Diwali Kurta + Tilak', blurb: 'Mustard silk kurta, cream churidar, tilak on the forehead and a red kalava thread.',
    for: M, top: { kind: 'kurta', color: '#e3a21b', trim: '#8a2a1a', sleeve: 1, len: 'knee' },
    bottom: { kind: 'churidar', color: '#f6efe0' }, shoes: { kind: 'jutti', color: '#6b3a1e', trim: '#e0b23c' },
    head: { kind: 'none', color: '#000' }, hair: 'sidepart', extras: ['tilak', 'kalava'], tweak: ['top', 'bottom'],
  },
  {
    id: 'pandit', community: 'hindu', facial: 'none', label: 'Pandit ji', blurb: 'White kurta, dhoti wrap, saffron angavastra, tilak and a string of mala beads.',
    for: MA, top: { kind: 'kurta', color: '#f4efe3', sleeve: 1, len: 'knee' },
    bottom: { kind: 'chadra', color: '#f7f2e6', trim: '#d9a21f' }, shoes: { kind: 'sandal', color: '#7a4a24' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'shoulders', color: '#e87a10', trim: '#c9540a', pattern: 'plain', wide: true },
    hair: 'balding', extras: ['tilak', 'kalava', 'glasses'], props: { R: 'tasbih' }, tweak: ['top', 'dupatta'],
  },
  {
    id: 'eid_kurta', community: 'muslim', facial: 'sunnah', label: 'Eid Shalwar Kameez + Topi', blurb: 'Pale green shalwar kameez, embroidered waistcoat, white crocheted topi and tasbih.',
    for: M, top: { kind: 'kurta', color: '#dfe9e1', trim: '#9bb5a3', sleeve: 1, len: 'knee' },
    outer: { kind: 'waistcoat', color: '#2f4a3c', trim: '#d9b86a', len: 'hip', sleeve: 0 },
    bottom: { kind: 'pajama', color: '#dfe9e1' }, shoes: { kind: 'sandal', color: '#6a4a2a' },
    head: { kind: 'topi', color: '#f7f5ee', trim: '#c9c2b0' }, hair: 'crop', extras: [], props: { R: 'tasbih' }, tweak: ['top', 'outer', 'bottom', 'head'],
  },
  {
    id: 'imam', community: 'muslim', facial: 'sunnah', label: 'Imam Sahib', blurb: 'Long white kurta, white pagri and a full beard: leading prayers at the mosque.',
    for: MA, top: { kind: 'kurta', color: '#f7f6f1', sleeve: 1, len: 'calf' },
    bottom: { kind: 'pajama', color: '#f1efe8' }, shoes: { kind: 'sandal', color: '#5a3a1e' },
    head: { kind: 'pagri', color: '#f6f3ea', trim: '#d6d1c3' }, extras: ['glasses'], props: { R: 'tasbih' }, tweak: ['top', 'head'],
  },
  {
    id: 'pagri_farmer', community: 'universal', facial: 'moustache', label: 'Punjabi Pagri Farmer', blurb: 'Loose white pagri with turla, kurta and a checked tehmat: the fields of both sides of Punjab.',
    for: MA, top: { kind: 'kurta', color: '#efe8d6', sleeve: 1, len: 'thigh' },
    bottom: { kind: 'chadra', color: '#cdd9e6', trim: '#3a5a8a' }, shoes: { kind: 'jutti', color: '#7a4a24' },
    head: { kind: 'pagri', color: '#f3efe2', trim: '#cfa23a' }, extras: [], props: { R: 'stick' }, tweak: ['top', 'bottom', 'head'],
  },
  {
    id: 'netaji', community: 'universal', facial: 'moustache', label: 'Neta ji (Gandhi Cap)', blurb: 'Crisp white kurta, navy Nehru jacket and a folded Gandhi topi.',
    for: MA, top: { kind: 'kurta', color: '#faf9f4', sleeve: 1, len: 'knee' },
    outer: { kind: 'waistcoat', color: '#2a3f5a', trim: '#1b2a3d', len: 'hip', sleeve: 0 },
    bottom: { kind: 'pajama', color: '#f6f5ef' }, shoes: { kind: 'formal', color: '#3a2412' },
    head: { kind: 'gandhi', color: '#f6f5ee', trim: '#dcd8cb' }, hair: 'crop', extras: ['glasses'], props: { L: 'phone' }, tweak: ['outer', 'head'],
  },
  {
    id: 'office_casual', community: 'universal', facial: 'stubble', label: 'Office Casual', blurb: 'Blue shirt, grey trousers, stubble and a phone: Sector 17 on a weekday.',
    for: MA, top: { kind: 'shirt', color: '#8fb4d9', sleeve: 1, len: 'hip', tucked: true },
    bottom: { kind: 'trousers', color: '#3a3f4a' }, shoes: { kind: 'formal', color: '#2a1a10' },
    head: { kind: 'none', color: '#000' }, hair: 'sidepart', extras: [], props: { L: 'phone' }, tweak: ['top', 'bottom'],
  },
  {
    id: 'street_casual', community: 'universal', facial: 'none', label: 'Street Casual', blurb: 'Hoodie, jeans and sneakers with a trendy side-part.',
    for: ['male', 'boy'], top: { kind: 'hoodie', color: '#3a6ea5', trim: '#ffffff', sleeve: 1, len: 'hip' },
    bottom: { kind: 'jeans', color: '#2d3f66' }, shoes: { kind: 'sneaker', color: '#f1f1f1', trim: '#e0332e' },
    head: { kind: 'none', color: '#000' }, hair: 'sidepart', extras: [], tweak: ['top', 'bottom'],
  },
  {
    ...policeBase, id: 'police_cap', community: 'universal', facial: 'moustache', label: 'Punjab Police (Peaked Cap)', blurb: 'Khaki uniform with the peaked cap, badge, belt and lathi.',
    head: { kind: 'cap', color: '#b5a064', trim: '#d9b43a' }, hair: 'crop', tweak: ['head'],
  },
  {
    id: 'church_m', community: 'christian', facial: 'none', label: 'Sunday Best (Church)', blurb: 'Dark blazer, white shirt, tie and a small cross for Sunday service.',
    for: M, top: { kind: 'shirt', color: '#f6f6f4', sleeve: 1, len: 'hip', tucked: true },
    outer: { kind: 'blazer', color: '#2a2f3a', len: 'thigh', sleeve: 1 },
    bottom: { kind: 'trousers', color: '#2a2f3a' }, shoes: { kind: 'formal', color: '#121212' },
    head: { kind: 'none', color: '#6b1d2a' }, hair: 'sidepart', extras: ['tie', 'cross'], tweak: ['outer'],
  },
  {
    ...schoolBase, id: 'school_plain', community: 'universal', label: 'School Uniform (no patka)', blurb: 'White shirt, navy shorts and a red tie with a neat crop.',
    head: { kind: 'none', color: '#000' }, hair: 'crop', tweak: ['bottom'],
  },
  // ---- women / aunties / girls
  {
    id: 'diwali_suit', community: 'hindu', label: 'Diwali Anarkali Suit', blurb: 'Maroon-and-gold flared suit with bindi, sindoor, mangalsutra and a gold dupatta.',
    for: F, top: { kind: 'kameez', color: '#a8203a', trim: '#e0b23c', sleeve: 1, len: 'calf' },
    bottom: { kind: 'churidar', color: '#e8c26a' }, shoes: { kind: 'heels', color: '#e0b23c' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'shoulders', color: '#e5ae2f', trim: '#a8203a', pattern: 'plain' },
    hair: 'bun', extras: ['earrings', 'bangles', 'bindi', 'sindoor', 'mangalsutra', 'hem_trim'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'saree', community: 'universal', label: 'Saree', blurb: 'Teal blouse and a rani-pink saree with the pallu over the shoulder.',
    for: FA, top: { kind: 'choli', color: '#1d6b5a', trim: '#e0b23c', sleeve: 0.5, len: 'crop' },
    bottom: { kind: 'lehenga', color: '#c9374f', trim: '#e0b23c' }, shoes: { kind: 'sandal', color: '#7a4a24' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'drape', color: '#c9374f', trim: '#e0b23c', pattern: 'plain', wide: true },
    hair: 'bun', extras: ['earrings', 'bangles', 'bindi', 'necklace'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'eid_suit', community: 'muslim', label: 'Eid Suit + Hijab', blurb: 'Emerald shalwar kameez with a cream dupatta wrapped over the head and shoulders.',
    for: F, top: { kind: 'kameez', color: '#2f7d6a', trim: '#e0c36a', sleeve: 1, len: 'knee' },
    bottom: { kind: 'salwar', color: '#2f7d6a' }, shoes: { kind: 'sandal', color: '#6a4a2a' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'hijab', color: '#f2efe6', trim: '#d9b86a', pattern: 'plain' },
    hair: 'loose', extras: ['earrings', 'bangles'], tweak: ['top', 'bottom', 'dupatta'],
  },
  {
    id: 'casual_f', community: 'universal', label: 'Kurti & Jeans', blurb: 'Coral kurti, jeans and open hair: shopping in the bazaar.',
    for: ['female', 'girl'], top: { kind: 'kurti', color: '#ef7d6e', trim: '#ffffff', sleeve: 0.6, len: 'thigh' },
    bottom: { kind: 'jeans', color: '#3a5a8a' }, shoes: { kind: 'sandal', color: '#e8d9a8' },
    head: { kind: 'none', color: '#000' }, hair: 'loose', extras: ['earrings'], props: { L: 'handbag' }, tweak: ['top', 'bottom'],
  },
  {
    id: 'church_f', community: 'christian', label: 'Church Sunday Suit', blurb: 'Pale blue suit with a white lace chunni over the head and a small cross.',
    for: F, top: { kind: 'kameez', color: '#f1f0ec', trim: '#8fa8c8', sleeve: 1, len: 'knee' },
    bottom: { kind: 'salwar', color: '#8fa8c8' }, shoes: { kind: 'sandal', color: '#b9a98a' },
    head: { kind: 'none', color: '#000' }, dupatta: { mode: 'head', color: '#f7f7f3', trim: '#c9ced8', pattern: 'plain' },
    hair: 'bun', extras: ['cross', 'earrings'], tweak: ['top', 'bottom'],
  },
);
const SIKH_HEADS = ['dastar', 'patka', 'nihang', 'rumal', 'police'];
/** Community of an outfit: explicit, else Sikh when worn with Sikh headwear (or the gurdwara sewadar), else universal. */
export function communityOf(o: OutfitDef): Community {
  if (o.community) return o.community;
  if (SIKH_HEADS.includes(o.head.kind) || o.id === 'sewadar_f') return 'sikh';
  return 'universal';
}
export const COMMUNITIES: Community[] = ['sikh', 'hindu', 'muslim', 'christian', 'universal'];
export const GREETINGS: Record<Community, { clip: string; text: string }> = {
  sikh: { clip: 'sat_sri_akal', text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ!' },
  hindu: { clip: 'namaste', text: 'ਨਮਸਤੇ ਜੀ!' },
  muslim: { clip: 'salaam', text: 'ਸਲਾਮ! Assalamu alaikum' },
  christian: { clip: 'wave', text: 'Sat Sri Akal ji! God bless' },
  universal: { clip: 'wave', text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ!' },
};
export const outfitsFor = (a: Archetype) => OUTFITS.filter((o) => o.for.includes(a));
export const getOutfit = (id: string) => OUTFITS.find((o) => o.id === id);
