import "@fontsource/baloo-paaji-2/gurmukhi-600.css";
import "@fontsource/baloo-paaji-2/gurmukhi-700.css";
import "@fontsource/baloo-paaji-2/latin-500.css";
import "@fontsource/baloo-paaji-2/latin-600.css";
import "@fontsource/baloo-paaji-2/latin-700.css";
import "@fontsource/baloo-paaji-2/latin-800.css";
import "@fontsource/noto-sans-gurmukhi/gurmukhi-600.css";
import "./ui/styles.css";
import { Game } from "./app/Game";

async function boot(): Promise<void> {
  // Make sure the bundled fonts are ready before signs are painted to canvases.
  await Promise.all([
    document.fonts.load('700 40px "Baloo Paaji 2"', "ਰੰਗਗੜ੍ਹ"),
    document.fonts.load('800 40px "Baloo Paaji 2"', "RANGGARH"),
    document.fonts.load('600 40px "Baloo Paaji 2"', "Bazaar"),
    document.fonts.load('600 40px "Noto Sans Gurmukhi"', "ਪੰਜਾਬ"),
  ]).catch(() => undefined);
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const ui = document.getElementById("ui") as HTMLDivElement;
  const game = new Game(canvas, ui);
  await game.init();
  (window as unknown as { __game?: Game }).__game = import.meta.env.DEV ? game : undefined;
}

boot().catch((e: unknown) => {
  console.error(e);
  const el = document.getElementById("ui");
  if (el) el.innerHTML = `<div class="fatal" role="alert"><h1>Could not start Punjabi Fun Shun</h1><p>${String(e)}</p><p>WebGL2 and WebAssembly are required.</p></div>`;
});
