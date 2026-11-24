// <st-scene-stats>: performance read-out for the 3D model, shown when the page URL has ?stats.
// Add &nomerge or &liveshadows to the URL to switch off mesh merging or the frozen shadow map and compare.

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <style>
    :host {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 5;
      pointer-events: none;
      font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #e8f0e0;
      background: rgba(10, 14, 20, 0.78);
      border-radius: 4px;
      padding: 6px 8px;
      min-width: 17ch;
    }
    .body {
      white-space: pre;
    }
    .fps {
      font-size: 15px;
      font-weight: 700;
    }
    .bad {
      color: #ff9c8a;
    }
  </style>
<div class="fps" part="fps"></div><div class="body" part="body"></div>`;

class SceneStats extends HTMLElement {
  #fpsEl: any = null;
  #bodyEl: any = null;
  #frames = 0;
  #frameMs = 0;
  #worstMs = 0;
  #windowStart = performance.now();
  #last = performance.now();
  /** @type {Record<string, string | number>} */
  #extra = {};

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).appendChild(TEMPLATE.content.cloneNode(true));
      this.#fpsEl = this.shadowRoot.querySelector('.fps');
      this.#bodyEl = this.shadowRoot.querySelector('.body');
    }
    this.setAttribute('aria-hidden', 'true');
  }

  /** Fixed facts shown under the live numbers (load time, merge counts...). */
  setInfo(info) {
    Object.assign(this.#extra, info);
  }

  /**
   * Call once per frame after rendering.
   * @param {{ info: { render: { calls: number, triangles: number }, memory: { geometries: number, textures: number }, programs?: unknown[] | null } }} renderer
   * @param {number} cpuMs JS time spent on this frame's update & render call
   */
  frame(renderer, cpuMs) {
    const now = performance.now();
    const dt = now - this.#last;
    this.#last = now;
    this.#frames++;
    this.#frameMs += cpuMs;
    this.#worstMs = Math.max(this.#worstMs, dt);
    const span = now - this.#windowStart;
    if (span < 500 || !this.#fpsEl) return;
    const fps = (this.#frames * 1000) / span;
    const { render, memory, programs } = renderer.info;
    this.#fpsEl.textContent = `${fps.toFixed(0)} fps`;
    this.#fpsEl.classList.toggle('bad', fps < 45);
    const lines = [
      `frame   ${(span / this.#frames).toFixed(1)} ms (worst ${this.#worstMs.toFixed(0)})`,
      `cpu     ${(this.#frameMs / this.#frames).toFixed(1)} ms`,
      `draws   ${render.calls}`,
      `tris    ${(render.triangles / 1000).toFixed(0)}k`,
      `geoms   ${memory.geometries}`,
      `texs    ${memory.textures}`,
      `shaders ${programs ? programs.length : '?'}`
    ];
    for (const [k, v] of Object.entries(this.#extra)) lines.push(`${k.padEnd(7)} ${v}`);
    this.#bodyEl.textContent = lines.join('\n');
    this.#frames = 0;
    this.#frameMs = 0;
    this.#worstMs = 0;
    this.#windowStart = now;
  }
}

if (!customElements.get('st-scene-stats')) {
  customElements.define('st-scene-stats', SceneStats);
}
