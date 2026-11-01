/** The incomplete outer world is intentionally limited to an explicit local
 * development probe; query parameters can never enable it in a production build. */
export function outerWorldEnabled(search: string, development: boolean): boolean {
  const params = new URLSearchParams(search);
  return development && params.has("probe") && params.get("outer") === "1";
}
