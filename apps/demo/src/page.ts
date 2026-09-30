import { html } from "lit";
import { captureIcon, replayIcon, probeIcon } from "./icons";

export const pageTemplate = html`
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <nav class="site-nav" aria-label="Main navigation">
      <a class="brand" href="#" aria-label="Sonda home"
        >${probeIcon}<span>sonda<span class="brand-period">.</span></span></a
      >
      <span class="nav-edition">ISSUE CAPTURE / LIVE DEMO</span>
      <a class="nav-lab" href="#capture-lab">Privacy test <span aria-hidden="true">↗</span></a>
    </nav>
  </header>
  <main id="main-content" tabindex="-1">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="signal-dash"></span> CAPTURE THE ISSUE. CLOSE THE LOOP.
        </div>
        <h1 id="hero-title">Less guessing.<br /><span>More fixing.</span></h1>
        <p>
          “It’s not working” is where the conversation starts.<br class="desktop-break" />
          Give your customers a way to show you the rest.
        </p>
        <div class="hero-actions">
          <button class="button button-primary" id="capture-screenshot" type="button">
            Try the live demo <span aria-hidden="true">↗</span></button
          ><span class="hero-caption">Screenshots. Replays.<br />Right inside your app.</span>
        </div>
      </div>
      <aside class="report-specimen" aria-label="Example customer issue report">
        <div class="specimen-index">
          <span>REPORT / CUSTOMER CONTEXT</span><span>DEMO — 001</span>
        </div>
        <div class="specimen-body">
          <div class="specimen-heading">
            ${captureIcon}<span>CUSTOMER REPORT</span><span class="example-label">EXAMPLE</span>
          </div>
          <p class="customer-quote">“I clicked upgrade.<br />Nothing happened.”</p>
          <div class="report-attachment">
            ${captureIcon}
            <div><strong>The exact screen.</strong><span>An annotated screenshot</span></div>
            <span class="file-type">PNG</span>
          </div>
          <div class="report-attachment">
            ${replayIcon}
            <div><strong>The steps before it.</strong><span>A replay of the session</span></div>
            <span class="file-type">JSON</span>
          </div>
          <div class="specimen-footer">
            <span class="specimen-plus" aria-hidden="true">+</span> A little evidence goes a long
            way.
          </div>
        </div>
        <div class="specimen-edge">
          <span>CAPTURE → UNDERSTAND → FIX</span><span aria-hidden="true">↗</span>
        </div>
      </aside>
      <div class="hero-readout" aria-label="Demo capabilities">
        <span><span class="status-dot" aria-hidden="true"></span> CAPTURE SYSTEM / READY</span>
        <span>01 SCREENSHOT &nbsp; / &nbsp; 02 SESSION REPLAY</span>
      </div>
    </section>

    <section class="captures-section" aria-labelledby="captures-title">
      <div class="section-heading">
        <div class="section-label">
          <span class="section-number">01</span>
          <h2 id="captures-title">The evidence.</h2>
        </div>
        <span id="capture-count" class="eyebrow">0 CAPTURES THIS SESSION</span>
      </div>
      <div id="results" aria-label="Accepted captures" data-replay-private>
        <div class="empty-results">
          <span class="empty-crosshair" aria-hidden="true">${captureIcon}</span>
          <div>
            <h3>Nothing captured. Yet.</h3>
            <p>
              Accept a screenshot or replay and it will land here, ready for your app to handle.
            </p>
          </div>
          <span class="empty-format">PNG / JSON</span>
        </div>
      </div>
      <div id="demo-status" role="status" aria-live="polite"></div>
    </section>

    <section class="testing-ground" id="capture-lab" aria-labelledby="lab-title">
      <div class="section-heading">
        <div class="section-label">
          <span class="section-number">02</span>
          <h2 id="lab-title">Put privacy to the test.</h2>
        </div>
        <span class="eyebrow section-side-note">REPLAY TEST BENCH</span>
      </div>
      <p class="lab-description">
        Type, scroll, and inspect a replay. Inputs are masked; private regions are blocked.
        Screenshots capture what’s visible.
      </p>
      <div class="form-grid">
        <div class="fixture">
          <span class="fixture-label">A / INPUT MASKING</span
          ><label for="test-name"
            >Customer name<input
              id="test-name"
              placeholder="Try typing something"
              autocomplete="off" /></label
          ><label for="test-password"
            >Password<input
              id="test-password"
              type="password"
              placeholder="Always masked in replay"
              autocomplete="off"
          /></label>
        </div>
        <div class="fixture">
          <span class="fixture-label">B / PRIVATE CONTENT</span>
          <p class="private" data-replay-private>
            Private account<br /><strong>SONDA_PRIVATE_7391</strong>
          </p>
          <p class="masked-text" data-replay-mask>Masked text: SONDA_MASKED_8426</p>
          <p class="fixture-note">
            This account block is excluded from replay. The line beneath it is masked.
          </p>
        </div>
        <div class="fixture">
          <span class="fixture-label">C / SCROLL CAPTURE</span>
          <div class="scroller" tabindex="0" aria-label="Nested scroll fixture">
            <div class="sticky-label">Customer activity <span>↓</span></div>
            ${Array.from({ length: 10 }, (_, i) => html`<p><span>${String(i + 1).padStart(2, "0")}</span> ${["Opened workspace", "Viewed billing", "Selected Team plan", "Clicked upgrade", "Received payment error"][i % 5]}</p>`)}
          </div>
          <p class="fixture-note">Scroll inside this list while recording.</p>
        </div>
      </div>
      <p class="privacy-note">
        Replays serialize eligible page DOM, including offscreen content. Masking inputs does not
        anonymize every text node, attribute, or asset URL. Reloading clears unsaved captures.
      </p>
    </section>
  </main>
  <footer class="site-footer">
    <a class="brand" href="#" aria-label="Sonda home"
      >${probeIcon}<span>sonda<span class="brand-period">.</span></span></a
    ><span>LESS BACK-AND-FORTH. MORE FIXING.</span
    ><a href="#main-content">Back to top <span aria-hidden="true">↗</span></a>
  </footer>
`;
