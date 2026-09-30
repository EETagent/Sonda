import { css } from "lit";
import { TEXT_LINE_HEIGHT } from "./annotations.js";

export const screenshotEditorStyles = css`
  :host {
    display: block;
    min-height: 0;
    color: #33333d;
    font:
      12px/1.5 -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: #f3f3f5;
  }
  .toolbar-area {
    flex: none;
    padding: 16px 24px 12px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    gap: 8px;
    padding: 5px;
    border: 1px solid #e2e2e8;
    border-radius: 11px;
    background: #fff;
    box-shadow:
      0 2px 5px #20202d06,
      0 8px 20px -12px #20202d14;
  }
  .tool-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .palette,
  .properties,
  .history {
    border-left: 1px solid #ececf0;
    padding-left: 8px;
  }
  button,
  select {
    font: inherit;
    color: inherit;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    min-height: 32px;
    padding: 6px 8px;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  button svg {
    width: 17px;
    height: 17px;
    flex: none;
  }
  .tool {
    font-size: 12px;
    font-weight: 500;
  }
  .tool[aria-pressed="true"] {
    background: #292930;
    color: #fff;
  }
  button:disabled {
    color: #b9b9c2;
    cursor: default;
  }
  button:focus-visible,
  select:focus-visible,
  canvas:focus-visible {
    outline: 2px solid var(--sonda-focus, #7050bb);
    outline-offset: 2px;
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .swatch {
    width: 27px;
    padding: 0;
    border-radius: 6px;
  }
  .swatch-dot {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--swatch-color);
    color: var(--swatch-ink);
    box-shadow: inset 0 0 0 1px #0000000d;
  }
  .swatch[aria-pressed="true"] {
    background: #f0f0f4;
  }
  .swatch-dot svg {
    width: 11px;
    height: 11px;
    stroke-width: 2.5;
  }
  .properties {
    min-width: 108px;
  }
  .setting {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .setting-name,
  .selection-hint {
    font-size: 11px;
    color: #72727e;
  }
  .selection-hint {
    padding: 0 6px;
  }
  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  select {
    appearance: none;
    -webkit-appearance: none;
    width: 60px;
    padding: 6px 17px 6px 5px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .select-wrap svg {
    position: absolute;
    right: 4px;
    width: 10px;
    height: 10px;
    transform: rotate(90deg);
    pointer-events: none;
    color: #90909b;
  }
  .icon-button {
    width: 32px;
    padding: 7px;
  }
  .clear-button {
    font-size: 11px;
    color: #7e7e89;
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    place-items: center;
    flex: 1;
    min-height: 0;
    padding: 12px 32px 20px;
    overflow: hidden;
  }
  .stage {
    position: relative;
    background: #fff;
    outline: 1px solid #1c1c2610;
    box-shadow:
      0 2px 4px #23232e06,
      0 12px 32px -12px #23232e20;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  #ink {
    position: absolute;
    inset: 0;
    touch-action: none;
    cursor: crosshair;
  }
  #ink[data-tool="select"] {
    cursor: default;
  }
  #ink[data-tool="text"] {
    cursor: text;
  }
  textarea {
    position: absolute;
    z-index: 2;
    font-family: Arial, sans-serif;
    line-height: ${TEXT_LINE_HEIGHT};
    border: 0;
    outline: 2px solid var(--sonda-focus, #7050bb);
    background: #ffffffeb;
    padding: 0;
    margin: 0;
    resize: none;
    overflow: hidden;
    min-width: 32px;
  }
  .selection-actions {
    display: flex;
    gap: 3px;
    padding: 3px;
    position: absolute;
    z-index: 3;
    background: white;
    border: 1px solid #e4e4e9;
    border-radius: 7px;
    box-shadow: 0 3px 12px #24243015;
  }
  .selection-actions button {
    font-size: 11px;
    min-height: 26px;
    padding: 3px 6px;
  }
  .move {
    touch-action: none;
    cursor: move;
  }
  .help {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    padding: 0 22px 12px;
    font-size: 11px;
    color: #6d6d79;
    gap: 16px;
  }
  .canvas-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    white-space: nowrap;
  }
  .zoom {
    border-left: 1px solid #dddde3;
    padding-left: 16px;
    font-variant-numeric: tabular-nums;
  }
  @media (hover: hover) and (pointer: fine) {
    button:hover:not(:disabled):not(.tool[aria-pressed="true"]),
    select:hover:not(:disabled) {
      background: #f2f2f6;
    }
  }
  @media (max-width: 740px) {
    .toolbar-area {
      padding: 12px 12px 8px;
    }
    .toolbar {
      gap: 6px;
    }
    .tool-label {
      display: none;
    }
    .tool {
      width: 34px;
      padding: 7px;
    }
    .properties {
      min-width: 90px;
    }
    .workspace {
      padding: 10px 16px 18px;
    }
  }
  @media (max-width: 540px) {
    .toolbar {
      width: 100%;
      row-gap: 5px;
      padding: 5px;
    }
    .tools {
      order: 0;
    }
    .history {
      order: 1;
      margin-left: auto;
      border: 0;
      padding: 0;
    }
    .palette {
      order: 2;
      border: 0;
      padding: 0;
    }
    .properties {
      order: 3;
      margin-left: auto;
      min-width: 64px;
      padding-left: 6px;
    }
    button,
    select {
      min-height: 36px;
    }
    .tool {
      width: 34px;
    }
    .swatch {
      width: 28px;
    }
    .swatch-dot {
      width: 19px;
      height: 19px;
    }
    .setting-name {
      display: none;
    }
    .selection-hint {
      width: 60px;
      font-size: 10px;
    }
    .help {
      padding: 0 14px 12px;
      font-size: 10px;
      align-items: flex-end;
    }
    .canvas-meta {
      gap: 8px;
    }
    .zoom {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
    button:active:not(:disabled) {
      transform: none;
    }
  }
`;
