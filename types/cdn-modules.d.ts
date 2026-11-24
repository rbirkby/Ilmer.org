/** Browser modules loaded from a CDN at runtime. Vite leaves the https:// imports external. */

declare module '*?worker&url' {
  const url: string;
  export default url;
}

declare module 'https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js' {
  export const map: any;
  export const latLngBounds: any;
  export const tileLayer: any;
  export const control: any;
  export const polygon: any;
  export const tooltip: any;
}

declare module 'https://cdn.skypack.dev/pin/lit@v3.3.1-mozE5P6MGQybGvSM4ae5/mode=imports,min/optimized/lit.js' {
  export const LitElement: any;
  export const html: any;
  export const css: any;
}
