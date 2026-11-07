// Lab: social and chat automation sandbox (rule-based, human approval, no live AI). Rendered by labPage() in scripts/build.mjs.
export default {
  slug: 'social-automation',
  field: 'design',
  title: 'Social and chat automation',
  blurb: 'A sandbox for drafting social posts and answering routine chat messages for a small business, with a human approving every post and rules that stop the bot inventing prices.',
  personas: ['design'],
  page() {
    return {
      situation: 'A small business in Windhoek needs steady social posts and quick WhatsApp-style answers, without hiring someone for it, but it cannot afford a bot that invents prices, discounts or promises. This lab shows the shape of a safe version: automation drafts the post and handles the routine questions, rules block the risky wording, and a person approves or takes over. The business, the offers and the conversations below are <b>fictional samples</b>.',
      look: [
        'Generate a week of drafts, then type a price or a "50% off" into a draft and watch the rules block it before it can be approved.',
        'Chat with the bot: ask for opening hours, ask what a cake costs (it refuses to guess), then book a table with a bad party size to see validation and hand-off.',
        'Open the test table at the bottom: every row is a real message run through the same engine, with a live pass or fail.',
      ],
      demo: `
<h3>A. Content calendar with an approval queue</h3>
<p class="lab-note"><span class="lab-badge">Sample</span> Drafts are written from templates for a fictional business. Nothing is posted anywhere and nothing leaves your browser.</p>
<form id="sa-brief" class="sa-brief" autocomplete="off">
  <label>Business<select id="sa-type"><option value="bakery">Sample Bakery</option><option value="salon">Sample Hair Studio</option><option value="hardware">Sample Hardware</option><option value="guesthouse">Sample Guesthouse</option></select></label>
  <label>Offer this week (your words, optional)<input id="sa-offer" type="text" maxlength="80" value="Free coffee with any pastry on Saturday" /></label>
  <label>Tone<select id="sa-tone"><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="playful">Playful</option></select></label>
  <label>Channel<select id="sa-channel"><option value="facebook">Facebook (500 characters)</option><option value="instagram">Instagram (300 characters)</option><option value="status">WhatsApp status (160 characters)</option></select></label>
  <label>Days<input id="sa-days" type="number" min="1" max="7" value="5" /></label>
  <button type="submit" class="btn btn--solid">Draft the posts</button>
</form>
<p id="sa-summary" class="lab-note" aria-live="polite"></p>
<ol id="sa-queue" class="sa-queue" aria-label="Draft posts"></ol>
<div class="lab-controls">
  <button type="button" id="sa-export-txt">Download approved (text)</button>
  <button type="button" id="sa-export-csv">Download approved (CSV)</button>
</div>
<p id="sa-live" class="sa-visually-hidden" role="status" aria-live="polite"></p>

<h3>B. Support bot as a flow</h3>
<p class="lab-note"><span class="lab-badge">Rule-based simulation</span> A small flow engine walking the graph below with keyword rules. No AI is called.</p>
<div class="sa-bot">
  <div class="sa-graph-wrap"><div id="sa-graph" aria-hidden="true"></div><p id="sa-node-status" class="lab-note" aria-live="polite"></p></div>
  <div class="sa-chatbox">
    <div id="sa-chat" class="sa-chat" role="log" aria-live="polite" aria-label="Conversation with the sample bot"></div>
    <div id="sa-quick" class="lab-controls" aria-label="Quick replies"></div>
    <form id="sa-say" class="sa-say" autocomplete="off">
      <label for="sa-input" class="sa-visually-hidden">Your message</label>
      <input id="sa-input" type="text" maxlength="120" placeholder="Type a message" />
      <button type="submit" class="btn btn--solid">Send</button>
      <button type="button" class="btn btn--line" id="sa-reset">Restart</button>
    </form>
  </div>
</div>
<h4 class="sa-trace-h">Trace: which node fired and why</h4>
<ol id="sa-trace" class="sa-trace" aria-label="Flow trace"></ol>

<h3>C. What I would ship</h3>
<p>The same engine is run against a fixed set of test messages. A row passes only if the bot visited the expected node and never said anything it must not say.</p>
<table class="lab-table" id="sa-tests">
  <caption>Evaluation of the flow (computed in your browser)</caption>
  <thead><tr><th>Test</th><th>Messages</th><th>Expected</th><th>Got</th><th>Result</th></tr></thead>
  <tbody></tbody>
</table>
<div class="lab-controls"><button type="button" id="sa-rerun">Run the tests again</button></div>`,
      built: `<p>One vanilla JavaScript file (<code>labs/social-automation.js</code>), no libraries and no network calls. The calendar is a template composer plus a rule checker; the bot is a small state machine, <code>step(state, text)</code>, that returns the replies, the nodes it fired and the trace lines. The flow graph, the transcript, the trace and the test table all read from that one function, so they cannot disagree.</p>
<ul>
  <li><b>Rules, not guesses.</b> The checker flags numbers and discount words that are not in the brief you typed, absolute claims such as "best" or "guaranteed", a missing call to action and posts over the channel limit. Wording that could mislead is a blocker: the Approve button stays disabled until it is fixed.</li>
  <li><b>A person decides.</b> Every post waits in a queue to be approved, edited, rejected or regenerated; only approved posts can be exported.</li>
  <li><b>A bot with edges.</b> Prices are never quoted, an instruction to ignore the rules is ignored, two misses or three failed answers in a booking hand the conversation to a person.</li>
  <li><b>Where AI would go.</b> A language-model step could draft the wording or the reply, but it would sit behind these same checks and the same hand-off, and it would be added on the server so no key reaches the browser. That is deliberately <b>not connected here</b>.</li>
</ul>`,
      limits: `<ul>
  <li>The business, the offers, the opening hours, the names and every conversation are fictional samples. No real business, price or person is involved.</li>
  <li>The drafts come from templates, not from an AI. The bot is a keyword rule set, not natural-language understanding, so it will miss phrasings a real flow would learn.</li>
  <li>Nothing is posted, sent or saved. Reloading the page clears everything; the downloads are built in your browser.</li>
  <li>This mirrors only what the main site already says about the chatbot platform (a flow engine with conditions, user-input steps, AI reply steps and hand-off to a human); it is not that platform and does not show its scale.</li>
</ul>`,
      scripts: ['/labs/social-automation.js'],
      css: ['/labs/social-automation.css'],
    };
  },
};
