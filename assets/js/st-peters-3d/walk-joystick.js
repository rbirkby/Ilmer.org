// <st-walk-joystick>: an on-screen thumb stick for walking around the church model on touch screens.
// Drag the knob to move; it springs back to the centre when released. Dispatches a `joystickmove` event whose
// detail is { x, y }, each from -1 to 1 (x: right, y: forward), on every change, and { x: 0, y: 0 } on release.

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      width: 112px;
      height: 112px;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    :host([hidden]) {
      display: none;
    }
    .base {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgb(24 22 20 / 55%);
      border: 1px solid var(--hud-accent, #d8aa54);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-sizing: border-box;
    }
    .knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 46px;
      height: 46px;
      margin: -23px 0 0 -23px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, #ffe9b8, #d8aa54);
      box-shadow: 0 2px 8px rgb(0 0 0 / 45%);
      transition: transform 0.12s ease-out;
    }
    :host([active]) .knob {
      transition: none;
    }
  </style>
  <div class="base" part="base"><div class="knob" part="knob"></div></div>
`;

export class WalkJoystick extends HTMLElement {
  #knob = null;
  #pointerId = null;
  #x = 0;
  #y = 0;

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).appendChild(TEMPLATE.content.cloneNode(true));
      this.#knob = this.shadowRoot.querySelector('.knob');
      this.addEventListener('pointerdown', this.#onDown);
      this.addEventListener('pointermove', this.#onMove);
      this.addEventListener('pointerup', this.#onUp);
      this.addEventListener('pointercancel', this.#onUp);
      this.addEventListener('lostpointercapture', this.#onUp);
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'application');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Walk joystick: drag to move');
  }

  /** Current stick position, each axis from -1 to 1 (x: right, y: forward). */
  get value() {
    return { x: this.#x, y: this.#y };
  }

  #onDown = (e) => {
    if (this.#pointerId !== null) return;
    this.#pointerId = e.pointerId;
    this.setPointerCapture(e.pointerId);
    this.setAttribute('active', '');
    e.preventDefault();
    e.stopPropagation();
    this.#track(e);
  };

  #onMove = (e) => {
    if (e.pointerId !== this.#pointerId) return;
    e.preventDefault();
    this.#track(e);
  };

  #onUp = (e) => {
    if (e.pointerId !== this.#pointerId) return;
    this.#pointerId = null;
    this.removeAttribute('active');
    this.#set(0, 0);
  };

  #track(e) {
    const rect = this.getBoundingClientRect();
    const radius = rect.width * 0.5;
    let dx = (e.clientX - (rect.left + radius)) / radius;
    let dy = (e.clientY - (rect.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.#set(dx, -dy);
  }

  #set(x, y) {
    this.#x = x;
    this.#y = y;
    if (this.#knob) {
      const travel = this.getBoundingClientRect().width * 0.32;
      this.#knob.style.transform = `translate(${x * travel}px, ${-y * travel}px)`;
    }
    this.dispatchEvent(new CustomEvent('joystickmove', { detail: { x, y } }));
  }
}

if (!customElements.get('st-walk-joystick')) {
  customElements.define('st-walk-joystick', WalkJoystick);
}
