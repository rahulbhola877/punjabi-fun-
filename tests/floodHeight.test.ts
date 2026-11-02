import {expect,it}from "vitest";
import {Weather}from "../src/world/Weather";
import {FLOOD_ZONES}from "../src/world/region";

it("keeps an elevated dry road or house floor out of the flood below it",()=>{
  // Exercise the production depth query without constructing the renderer.
  const weather=Object.create(Weather.prototype) as Weather;weather.flood=1;
  const f=FLOOD_ZONES[0]!,x=(f.x0+f.x1)/2,z=(f.z0+f.z1)/2;
  const street=weather.floodAt(x,z,0);expect(street).toBeGreaterThan(.1);
  expect(weather.floodAt(x,z,street+1)).toBe(0);
  expect(weather.floodAt(x,z,street/2)).toBeCloseTo(street/2);
});
