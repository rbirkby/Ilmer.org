class AIColorizeToggle extends HTMLElement {
  static observedAttributes = ['aria-busy', 'aria-label', 'aria-pressed', 'data-state', 'disabled', 'title'];

  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --progress: 0%;
          --ring-color: rgb(115 220 255 / 98%);
          position: absolute;
          top: 0.8rem;
          right: 0.8rem;
          z-index: 2;
          display: inline-flex;
        }

        button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3.6rem;
          height: 3.6rem;
          border: 0;
          border-radius: 999px;
          background: rgb(21 23 26 / 82%);
          color: #fff;
          box-shadow: 0 0.4rem 1.4rem rgb(0 0 0 / 20%);
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition:
            transform 150ms ease,
            background 150ms ease,
            opacity 150ms ease,
            box-shadow 150ms ease;
        }

        button::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 0.28rem;
          border-radius: inherit;
          background: conic-gradient(from -90deg, var(--ring-color) 0 var(--progress), transparent var(--progress) 100%);
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
          will-change: transform;
        }

        button:hover,
        button:focus-visible {
          transform: translateY(-1px);
          background: rgb(38 168 237 / 92%);
          outline: none;
        }

        .sparkle {
          font-size: 1.7rem;
          line-height: 1;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        :host([data-state='active']) {
          --ring-color: rgb(255 96 214 / 98%);
        }

        :host([data-state='active']) button {
          background: radial-gradient(circle at 30% 30%, rgb(255 255 255 / 18%), transparent 45%), rgb(14 16 28 / 94%);
          box-shadow:
            0 0 0.4rem rgb(255 79 216 / 38%),
            0 0 1.1rem rgb(0 187 255 / 24%),
            0 0.4rem 1.4rem rgb(0 0 0 / 26%);
        }

        :host([data-state='loading']) button {
          cursor: progress;
        }

        :host([data-state='loading']) button::before {
          animation: ai-colorize-spin 1.4s linear infinite;
        }

        :host([data-state='loading']) .sparkle {
          animation: ai-colorize-pulse 1.1s ease-in-out infinite;
        }

        :host([data-state='error']) {
          --ring-color: rgb(255 183 183 / 98%);
        }

        :host([data-state='error']) button {
          background: rgb(168 59 59 / 92%);
        }

        :host([data-state='active']) .sparkle {
          background: linear-gradient(
            135deg,
            #ff005d 0%,
            #ff6a00 12%,
            #fff000 24%,
            #78ff00 38%,
            #00ffd5 54%,
            #00c2ff 70%,
            #7b61ff 84%,
            #ff4fd8 100%
          );
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          filter: saturate(2.2) brightness(1.28) contrast(1.16) drop-shadow(0 0 0.18rem rgb(255 255 255 / 60%))
            drop-shadow(0 0 0.4rem rgb(255 0 128 / 32%)) drop-shadow(0 0 0.65rem rgb(0 194 255 / 26%));
          transform: scale(1.04);
        }

        @keyframes ai-colorize-pulse {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.06);
          }
        }

        @keyframes ai-colorize-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      </style>
      <button type="button" part="button">
        <span class="sparkle" aria-hidden="true">✨</span>
        <span class="sr-only">Toggle AI colourisation</span>
      </button>
    `;

    this.button = this.shadowRoot.querySelector('button');
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  connectedCallback() {
    this.syncButtonState();
  }

  attributeChangedCallback() {
    this.syncButtonState();
  }

  syncButtonState() {
    if (!this.button) {
      return;
    }

    this.button.disabled = this.disabled;
    this.button.title = this.getAttribute('title') ?? '';
    this.button.setAttribute('aria-busy', this.getAttribute('aria-busy') ?? 'false');
    this.button.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Toggle AI colourisation');
    this.button.setAttribute('aria-pressed', this.getAttribute('aria-pressed') ?? 'false');
  }
}

if (!customElements.get('ai-colorize-toggle')) {
  customElements.define('ai-colorize-toggle', AIColorizeToggle);
}
