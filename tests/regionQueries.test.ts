import { describe, expect, it } from 'vitest';
import { RectIndex } from '../src/world/RectIndex';
import { ROADS, OUTER_BUILDINGS, inRectR, onRoad, isOpenCountry } from '../src/world/region';

describe('streaming spatial queries', () => {
  it('preserves road priority, padding, boundaries and wide-query fallback', () => {
    const points = ROADS.flatMap(r => [[r.x0, r.z0], [r.x1, r.z1], [(r.x0+r.x1)/2, (r.z0+r.z1)/2], [r.x0-4.5, r.z0-4.5]]);
    for (let x=-1200;x<=1200;x+=73) for(let z=-1200;z<=1200;z+=79) points.push([x,z]);
    for (const [x,z] of points) for (const pad of [-1,0,.6,4.5,8,12]) {
      expect(onRoad(x!,z!,pad)).toBe(ROADS.find(r=>inRectR(r,x!,z!,pad))??null);
    }
  });
  it('keeps building edges blocked and indexes negative cell boundaries', () => {
    const index = new RectIndex(OUTER_BUILDINGS,40,.6);
    for (const b of OUTER_BUILDINGS) for(const [x,z] of [[b.x0-.6,b.z0-.6],[b.x1+.6,b.z1+.6],[(b.x0+b.x1)/2,(b.z0+b.z1)/2]]) {
      expect(index.at(x!,z!)).toContain(b);
      expect(isOpenCountry(x!,z!)).toBe(false);
    }
  });
});
