import { css } from "lit";
export const widgetStyles = css`
  :host {
    all: initial;
    position: fixed;
    right: var(--sonda-offset, 24px);
    bottom: var(--sonda-offset, 24px);
    z-index: var(--sonda-z-index, 2147483000);
    font:
      14px/1.5 -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    color: #202126;
    color-scheme: light;
  }
  :host([position="top-left"]) {
    top: calc(var(--sonda-offset, 24px) + 16px);
    left: var(--sonda-offset, 24px);
    bottom: auto;
    right: auto;
  }
  :host([position="top-right"]) {
    top: calc(var(--sonda-offset, 24px) + 16px);
    bottom: auto;
  }
  :host([position="bottom-left"]) {
    left: var(--sonda-offset, 24px);
    right: auto;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  button,
  select,
  input {
    font: inherit;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid #e4e4e7;
    background: white;
    color: inherit;
    border-radius: 8px;
    padding: 8px 14px;
    min-height: 36px;
    font-size: 13px;
    cursor: pointer;
    transition:
      background 140ms ease,
      transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--sonda-focus, #7050bb);
    outline-offset: 2px;
  }
  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  button.primary {
    background: var(--sonda-accent, #25262b);
    border-color: transparent;
    color: var(--sonda-accent-ink, #fff);
    font-weight: 600;
  }
  button.icon {
    width: 32px;
    min-height: 32px;
    padding: 6px;
    border-color: transparent;
  }
  .launcher {
    position: relative;
    isolation: isolate;
    width: 58px;
    height: 58px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--sonda-launcher-ink, #d6f5bc);
  }
  .launcher:disabled {
    opacity: 1;
  }
  .launcher::before,
  .launcher::after {
    content: "";
    position: absolute;
    inset: -5px;
    z-index: -1;
    border: 1px solid var(--sonda-focus, #719952);
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
  }
  .launcher[data-active]::before,
  .launcher[data-active]::after {
    animation: launcher-ripple 2400ms cubic-bezier(0.23, 1, 0.32, 1) infinite;
  }
  .launcher[data-active]::after {
    animation-delay: 1200ms;
  }
  .launcher buddy-avatar {
    flex: none;
    pointer-events: none;
  }
  .launcher buddy-avatar::part(svg) {
    filter: drop-shadow(0 4px 7px #20302118) drop-shadow(0 12px 18px #20302124);
  }
  .launcher buddy-avatar::part(body) {
    stroke: var(--sonda-launcher-border, #516649);
    stroke-width: 4;
    transition: fill 160ms ease;
  }
  @keyframes launcher-ripple {
    from {
      transform: scale(0.96);
      opacity: 0.4;
    }
    to {
      transform: scale(1.4);
      opacity: 0;
    }
  }
  .panel {
    position: absolute;
    bottom: 92px;
    right: 0;
    width: min(300px, calc(100vw - 32px));
    max-height: calc(100dvh - 132px);
    overflow: auto;
    border: 1px solid #e6e6e9;
    border-radius: 14px;
    background: #fff;
    padding: 6px;
    box-shadow:
      0 16px 48px -12px #1b1c2430,
      0 3px 8px #1b1c2408;
  }
  :host([position^="top"]) .panel {
    top: 76px;
    bottom: auto;
  }
  :host([position$="left"]) .panel {
    left: 0;
    right: auto;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 6px 7px 10px;
  }
  .panel h2 {
    font-size: 13px;
    letter-spacing: -0.01em;
    margin: 0;
    font-weight: 600;
  }
  .panel-head .icon {
    color: #898a94;
    width: 28px;
    min-height: 28px;
  }
  .panel-head .icon svg {
    width: 16px;
    height: 16px;
  }
  .choice {
    width: 100%;
    text-align: left;
    justify-content: flex-start;
    gap: 12px;
    padding: 12px 10px;
    border: 0;
    border-radius: 8px;
    margin: 1px 0;
  }
  .choice-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 38px;
    color: #52525e;
  }
  .choice-icon svg {
    width: 23px;
    height: 23px;
  }
  .choice strong {
    display: block;
    font-size: 13px;
    line-height: 1.5;
    font-weight: 550;
    letter-spacing: -0.015em;
  }
  .choice small {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: #72727e;
    line-height: 1.5;
  }
  .choice-chevron {
    display: flex;
    margin-left: auto;
    color: #a2a2ab;
  }
  .choice-chevron svg {
    width: 14px;
    height: 14px;
  }
  .privacy {
    margin: 8px -6px -6px;
    padding: 0 14px;
    border-top: 1px solid #eeeef0;
    color: #72727e;
    font-size: 11px;
  }
  .privacy summary {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
    cursor: pointer;
    list-style: none;
  }
  .privacy summary::-webkit-details-marker {
    display: none;
  }
  .privacy summary svg {
    width: 13px;
    height: 13px;
    flex: none;
  }
  .privacy summary svg:last-child {
    margin-left: auto;
    transform: rotate(90deg);
  }
  .privacy[open] summary svg:last-child {
    transform: rotate(-90deg);
  }
  .privacy p {
    margin: 0 0 12px;
    line-height: 1.6;
    color: #656570;
  }
  .status-pill {
    position: absolute;
    right: 72px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 9px 10px 9px 15px;
    border: 1px solid #dfe6da;
    border-radius: 14px;
    background: white;
    box-shadow: 0 6px 30px #26372420;
    white-space: nowrap;
  }
  :host([position$="left"]) .status-pill {
    left: 72px;
    right: auto;
  }
  .status-pill .time {
    font-variant-numeric: tabular-nums;
    min-width: 38px;
  }
  .record-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dc5347;
  }
  .status-pill button {
    min-height: 34px;
    padding: 5px 9px;
  }
  dialog {
    position: fixed;
    inset: 0;
    margin: auto;
    padding: 0;
    width: min(1160px, calc(100vw - 48px));
    height: min(860px, calc(100dvh - 48px));
    max-width: none;
    max-height: calc(100dvh - 48px);
    border: 1px solid #ffffff80;
    border-radius: 16px;
    color: #202126;
    background: #fff;
    box-shadow:
      0 32px 96px -20px #15151e55,
      0 0 0 1px #18181b12;
    overflow: hidden;
    font: inherit;
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: #17172066;
    backdrop-filter: blur(4px);
  }
  .dialog-head {
    display: flex;
    flex: none;
    align-items: center;
    padding: 14px 20px;
    gap: 16px;
    border-bottom: 1px solid #ececf0;
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .document-icon {
    display: flex;
    color: #777782;
  }
  .document-icon svg {
    width: 18px;
    height: 18px;
  }
  .dialog-head h2 {
    font-size: 14px;
    line-height: 1.4;
    margin: 0;
    letter-spacing: -0.02em;
    font-weight: 600;
  }
  .dialog-head h2:focus {
    outline: none;
  }
  .capture-dimensions {
    margin-left: auto;
    color: #72727e;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .dialog-head > .icon {
    margin-left: auto;
    color: #797984;
  }
  .capture-dimensions + .icon {
    margin-left: 0;
  }
  sonda-screenshot-editor {
    flex: 1;
    min-height: 0;
  }
  .dialog-foot {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    padding: 14px 20px;
    border-top: 1px solid #ececf0;
  }
  .dialog-foot .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
    color: #72727e;
    font-size: 11px;
  }
  .hint svg {
    width: 13px;
    height: 13px;
  }
  .dialog-foot .primary {
    min-width: 96px;
    box-shadow: 0 1px 2px #18181b18;
  }
  .dialog-foot .primary svg {
    width: 16px;
    height: 16px;
  }
  button.quiet {
    border-color: transparent;
    color: #64646f;
  }
  .notice {
    flex: none;
    padding: 10px 20px;
    color: #665222;
    background: #fff9ec;
    font-size: 12px;
  }
  .capture-notice {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    color: #756c56;
    background: #faf9f6;
    border-bottom: 1px solid #f0eeea;
    font-size: 11px;
    line-height: 1.5;
  }
  .capture-notice svg {
    width: 14px;
    height: 14px;
    flex: none;
  }
  .error {
    color: #923e35;
    background: #fff0eb;
    padding: 12px;
    border-radius: 9px;
    font-size: 12px;
    margin-bottom: 10px;
  }
  .preview {
    flex: 1;
    min-height: 0;
    width: 100%;
    background: #f3f3f5;
    position: relative;
    overflow: hidden;
  }
  .playback {
    display: flex;
    flex: none;
    align-items: center;
    padding: 12px 24px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .playback input {
    flex: 1;
    min-width: 90px;
    accent-color: #395a36;
  }
  .playback select {
    padding: 8px;
    border-radius: 6px;
    background: white;
    border: 1px solid #dfe5da;
  }
  .playback time {
    font-size: 11px;
    color: #6c7666;
    font-variant-numeric: tabular-nums;
  }
  .loading {
    padding: 45px 24px;
    text-align: center;
    color: #6c7666;
  }
  @media (hover: hover) and (pointer: fine) {
    button:hover:not(:disabled) {
      background: #f5f5f7;
    }
    button.primary:hover:not(:disabled) {
      background: var(--sonda-accent-hover, #3d3d46);
    }
    .launcher:hover:not(:disabled) {
      background: transparent;
    }
  }
  @media (max-width: 640px) {
    :host {
      --sonda-offset: 16px;
    }
    .status-pill {
      top: auto;
      bottom: 88px;
      right: 0;
      transform: none;
    }
    :host([position^="top"]) .status-pill {
      top: 72px;
      bottom: auto;
    }
    :host([position$="left"]) .status-pill {
      left: 0;
      right: auto;
    }
    dialog {
      width: calc(100vw - 20px);
      height: calc(100dvh - 24px);
      max-height: calc(100dvh - 24px);
      border-radius: 12px;
    }
    .dialog-head,
    .dialog-foot {
      padding: 12px;
    }
    .dialog-head {
      gap: 8px;
    }
    .dialog-heading {
      gap: 8px;
    }
    .capture-dimensions {
      display: none;
    }
    .dialog-head > .icon {
      margin-left: auto;
    }
    .dialog-foot .hint {
      font-size: 10px;
    }
    .playback {
      padding: 10px;
      gap: 7px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .launcher[data-active]::before,
    .launcher[data-active]::after {
      animation: none;
    }
    .launcher[data-active]::before {
      opacity: 0.4;
    }
    .launcher buddy-avatar::part(body) {
      transition: none;
    }
    button {
      transition: none;
    }
    button:active:not(:disabled) {
      transform: none;
    }
  }
`;
