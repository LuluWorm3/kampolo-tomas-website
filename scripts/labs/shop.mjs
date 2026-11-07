// Lab: Shop checkout and images. Real licensed photographs, in-browser measurements, a test-data purchase flow.
// Photos and credits come from scripts/photos.json (credits are written there by scripts/fetch-photos.mjs after the licence check).
// The shop's data and image sizes come from labs/shop-products.json (python scripts/build-lab-shop-images.py).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export default {
  slug: 'shop',
  field: 'shop',
  title: 'Shop checkout and images',
  blurb: 'Real photographs, loading measured in your own browser, and a complete test purchase from product page to confirmation.',
  personas: ['shop'],
  page({ esc }) {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'photos.json'), 'utf8'));
    const vat = m.shop.vat;
    const credited = [{ id: 'hero', label: 'Header photo', ...m.hero }, ...m.products.map((p) => ({ label: p.name, ...p }))];
    const missing = credited.filter((p) => !p.credit);
    if (missing.length) throw new Error('shop lab: no verified credit for ' + missing.map((p) => p.id).join(', ') + '. Run node scripts/fetch-photos.mjs');
    const credits = credited.map((p) => {
      const c = p.credit;
      const lic = c.licenceUrl ? `<a href="${esc(c.licenceUrl)}" rel="noopener">${esc(c.licence)}</a>` : esc(c.licence);
      return `<li><strong>${esc(p.label)}.</strong> “${esc(c.title)}” by ${esc(c.author)}, ${lic}. <a href="${esc(c.page)}" rel="noopener">Source: ${esc(c.source)}</a>.</li>`;
    }).join('');

    const naiveSnippet = esc(`<img src="/img/lab-shop/full/basket-bowl.jpg" alt="…">
<!-- 2400 px JPEG, no width or height, loads at once -->`);
    const optSnippet = esc(`<picture>
  <source type="image/webp" sizes="(max-width: 720px) 44vw, 200px"
    srcset="…-400.webp 400w, …-800.webp 800w, …-1200.webp 1200w">
  <img src="…-800.jpg" srcset="…-400.jpg 400w, …" sizes="…"
    width="1200" height="900" loading="lazy" decoding="async" alt="…">
</picture>
<!-- box reserved by aspect ratio, tiny blurred placeholder behind it -->`);

    return {
      situation: `A small shop's photographs are usually the heaviest part of its page. On a phone with a weak signal they arrive slowly, and when they arrive without reserved space the text and buttons jump under the visitor's thumb. The checkout is the next place a buyer gives up: a long form, vague error messages, a fee that appears only at the end. This lab takes a made-up shop that sells things you could find at a Namibian market (baskets, clay bowls, cloth dolls, wool, carvings, dried fruit and fish) and shows both problems being handled.`,
      look: [
        `<strong>Run the comparison.</strong> The same eight photographs are placed twice: once the careless way, once the careful way. The numbers (layout shift, when the largest image was painted, bytes) are measured by your own browser as the images load.`,
        `<strong>Read the connection table.</strong> It works out how long each version would take at four assumed connection speeds, from the real file sizes.`,
        `<strong>Buy something.</strong> Open a product, pick a size, change the quantity in the cart, choose a delivery region, then try to place the order with the form empty to see the errors. All of it is test data.`,
      ],
      demo: `
<p><span class="lab-badge">Sample data</span> <span class="lab-note">Every product, price, size and delivery fee below is made up for the demo. The photographs are real and credited under “Limits and sources”.</span></p>
<noscript><p>This demo needs JavaScript. Everything runs in your browser; nothing is sent anywhere.</p></noscript>

<section class="shopx-sec" aria-labelledby="shopx-a">
  <h3 id="shopx-a">A. Loading: careless markup against careful markup</h3>
  <p class="lab-note">The two grids below are built one after the other and measured separately; the page scrolls each into view first, because a browser only counts what moves on screen. Your connection is probably faster than a customer's on mobile data, so also try the simulated delay: it holds the images back for the same time in both grids so the jumping becomes visible. It is a simulation, not your network.</p>
  <div class="lab-controls shopx-controls">
    <button type="button" id="shopx-run">Run the comparison</button>
    <label class="shopx-field" for="shopx-delay">Simulated delay before images are requested
      <select id="shopx-delay"><option value="0">None (your real connection)</option><option value="1500">1.5 seconds</option><option value="4000">4 seconds</option></select>
    </label>
  </div>
  <div class="shopx-cmp">
    <div class="shopx-col">
      <h4>Careless markup</h4>
      <div class="shopx-stage" id="shopx-stage-naive" role="region" aria-label="Careless markup result" tabindex="0"><p class="shopx-empty">Press “Run the comparison”.</p></div>
      <pre class="shopx-code"><code>${naiveSnippet}</code></pre>
    </div>
    <div class="shopx-col">
      <h4>Careful markup</h4>
      <div class="shopx-stage" id="shopx-stage-opt" role="region" aria-label="Careful markup result" tabindex="0"><p class="shopx-empty">Press “Run the comparison”.</p></div>
      <pre class="shopx-code"><code>${optSnippet}</code></pre>
    </div>
  </div>
  <p class="shopx-status" id="shopx-status" role="status" aria-live="polite"></p>
  <table class="lab-table shopx-results">
    <caption>Measured in this browser</caption>
    <thead><tr><th scope="col">Measure</th><th scope="col" class="num">Careless</th><th scope="col" class="num">Careful</th></tr></thead>
    <tbody id="shopx-results">
      <tr><th scope="row">Layout shift (CLS)</th><td class="num" data-k="cls-naive">–</td><td class="num" data-k="cls-opt">–</td></tr>
      <tr><th scope="row">Largest visible image loaded at</th><td class="num" data-k="paint-naive">–</td><td class="num" data-k="paint-opt">–</td></tr>
      <tr><th scope="row">Page LCP candidate from this grid</th><td class="num" data-k="lcp-naive">–</td><td class="num" data-k="lcp-opt">–</td></tr>
      <tr><th scope="row">All requested images finished at</th><td class="num" data-k="done-naive">–</td><td class="num" data-k="done-opt">–</td></tr>
      <tr><th scope="row">Image requests</th><td class="num" data-k="req-naive">–</td><td class="num" data-k="req-opt">–</td></tr>
      <tr><th scope="row">Bytes received (measured)</th><td class="num" data-k="bytes-naive">–</td><td class="num" data-k="bytes-opt">–</td></tr>
      <tr><th scope="row">Bytes of the files chosen (file sizes)</th><td class="num" data-k="decl-naive">–</td><td class="num" data-k="decl-opt">–</td></tr>
    </tbody>
  </table>
  <p class="lab-note">CLS is the layout-shift score from the browser's Layout Instability API; lower is better. “Largest visible image loaded at” is the load time of the biggest image showing in each grid. “Page LCP candidate” comes from the Largest Contentful Paint API and only has a value when a grid image became the largest thing on the whole page. If your browser does not support one of these, it says so instead of guessing.</p>
</section>

<section class="shopx-sec" aria-labelledby="shopx-b">
  <h3 id="shopx-b">B. How long would it take on a slow connection?</h3>
  <p class="lab-note">Estimates, not measurements: round-trip time plus size divided by speed, with every image fetched in parallel. They ignore connection warm-up. The four connection profiles are assumptions for illustration, not measured Namibian speeds.</p>
  <div class="lab-controls shopx-controls">
    <label class="shopx-field" for="shopx-speed-for">Show the time for
      <select id="shopx-speed-for"></select>
    </label>
  </div>
  <div class="shopx-tablewrap">
    <table class="lab-table" id="shopx-speed">
      <caption id="shopx-speed-cap">Estimated download time</caption>
      <thead><tr><th scope="col">Connection</th><th scope="col" class="num">Careless: full photo</th><th scope="col" class="num">Careful: phone size</th><th scope="col" class="num">Careful: desktop size</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</section>

<section class="shopx-sec" aria-labelledby="shopx-c">
  <h3 id="shopx-c">C. A test purchase, from product to confirmation</h3>
  <p class="lab-note">Nothing here is sent, saved or charged. There is no payment step and no account. The cart lives in this page only and is gone when you reload it.</p>
  <div id="shopx-app" class="shopx-app"><p class="shopx-empty">Loading the sample shop…</p></div>
  <p class="shopx-sr" id="shopx-live" role="status" aria-live="polite" aria-atomic="true"></p>
</section>`,
      built: `
<ul>
  <li><strong>Photographs.</strong> Real photos from Wikimedia Commons, accepted only when the page reports CC0, public domain, CC BY or CC BY-SA. <code>scripts/fetch-photos.mjs</code> checks that before it saves anything, writes the author and licence into <code>scripts/photos.json</code>, and rejects anything else. Originals stay in an ignored folder. <code>scripts/build-lab-shop-images.py</code> crops each to 4:3 and writes WebP and JPEG at 400, 800 and 1200 px, plus a 16 px blurred placeholder.</li>
  <li><strong>Careful markup.</strong> Fixed <code>width</code> and <code>height</code> plus a CSS aspect ratio so the box exists before the file arrives; <code>srcset</code> and <code>sizes</code> so a phone takes the 400 px file; WebP with a JPEG fallback inside <code>picture</code>; <code>loading="lazy"</code> below the first row; <code>decoding="async"</code>; a tiny blurred placeholder behind each photo until it arrives.</li>
  <li><strong>Measuring.</strong> A <code>PerformanceObserver</code> watches <code>layout-shift</code> and <code>largest-contentful-paint</code> entries; the image <code>load</code> events and Resource Timing give load times and bytes. Each grid is built and settled on its own so the numbers do not mix, and every image URL carries a one-off query string so the browser cannot answer from cache.</li>
  <li><strong>Checkout.</strong> Plain DOM code, no framework. Prices include VAT, as shop prices usually do, so the summary shows the VAT contained in the total. Each field has a label and a hint; on submit the errors are collected into a summary that takes focus and links to each field, and every field also shows its own message tied to it with <code>aria-describedby</code>. Cart changes are announced in a polite live region.</li>
  <li><strong>Trade-offs.</strong> The cart is in memory only, so a reload clears it; that keeps the page free of cookies and storage. The slow-connection table is arithmetic, not a network test. Layout Instability and Largest Contentful Paint are Chromium features, so other browsers show “not supported” for those rows.</li>
</ul>`,
      limits: `
<ul>
  <li><strong>Sample, not real.</strong> The shop, products, prices, sizes, delivery zones and fees are invented for this demo. There are no customers, orders or sales behind it. The “order” is never stored or sent, and no payment is taken.</li>
  <li><strong>VAT.</strong> The sample uses a flat rate of ${Math.round(vat.rate * 100)}%, the standard VAT rate in Namibia according to the Namibia Revenue Agency's general tax brochure (<a href="${esc(vat.url)}" rel="noopener">NamRA, General Tax Information</a>, read ${esc(vat.checked)}). The same brochure says some supplies are taxed at 0% or exempt; this demo does not model that, so treat the VAT line as an illustration.</li>
  <li><strong>CLS thresholds.</strong> Layout shift below 0.1 is generally treated as good and above 0.25 as poor, following the Core Web Vitals guidance published at web.dev.</li>
  <li><strong>Connection speeds.</strong> The four profiles in table B are assumptions chosen to show the range, not measurements.</li>
  <li><strong>What was and was not tested.</strong> The measurements were checked in Chrome. Firefox, Safari, real phones and real slow networks were not tested, and the demo does not claim results for them.</li>
  <li><strong>Photographs.</strong> The photos were resized and cropped, which counts as a modification under the licences below. CC BY-SA photographs stay under their own licence; this does not change the licence of the rest of the site. Photos of people were not used.</li>
</ul>
<h3 class="shopx-credits-title">Photo credits</h3>
<ul class="shopx-credits">${credits}</ul>`,
      scripts: ['/labs/shop.js'],
      css: ['/labs/shop.css'],
    };
  },
};
