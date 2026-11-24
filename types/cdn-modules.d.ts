/** Browser modules loaded from a CDN at runtime. Vite leaves the https:// imports external. */

declare module '*?worker&url' {
  const url: string;
  export default url;
}

// Typed by the matching npm packages (devDependencies), which are only used for their types.
declare module 'https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js' {
  export * from 'leaflet';
}

declare module 'https://cdn.skypack.dev/pin/lit@v3.3.1-mozE5P6MGQybGvSM4ae5/mode=imports,min/optimized/lit.js' {
  export * from 'lit';
}
