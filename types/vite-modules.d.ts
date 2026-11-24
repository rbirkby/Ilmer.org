/** Vite import suffixes used by the browser bundles. */

declare module '*?worker&url' {
  const url: string;
  export default url;
}

declare module '*?inline' {
  const css: string;
  export default css;
}
