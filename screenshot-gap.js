// Knotie AI Pro docs — tighten the gap between two or more adjacent
// screenshots in the MDX content body.
//
// Why this file exists
// --------------------
// In dev preview, Mintlify renders each `![alt](src)` as
//   <p><span data-rmiz><span><span><img class="rounded" ...></span></span></span></p>
// and the Tailwind `prose` styles give the <img> ~32px top + bottom margin,
// so two adjacent screenshots already have a visible gap.
//
// In production, Mintlify's optimizer rewrites that to
//   <span data-rmiz><span><picture class="contents"><img class="object-contain" ...></picture></span></span>
// where the outer spans are `display: contents` and the <picture> has
// `display: contents` too — so the prose margin on the <picture> is ignored
// (per CSS spec, `display: contents` generates no box) and consecutive
// <img> elements end up with 0px margin between them, producing one tall
// wall of stitched images with no breathing room.
//
// We can't fix this with a stylesheet alone:
//   1. docs.json has no `stylesheets`/`customCss` key (not in the Mintlify
//      schema), so a project-level style.css isn't bundled in the prod build.
//   2. Even if it were, `display: contents` means a CSS `margin-top` on the
//      <picture> wrapper would still be ignored.
//
// So we apply the margin in JS to the actual rendered <img> (which is the
// first non-`display:contents` ancestor and therefore a real box that can
// accept margins). We only touch the article body — nav, footer, and the
// lightbox modal clones are left alone — and we re-run on route change
// because Mintlify is a Next.js SPA.
//
// Adjacency rule
// --------------
// A "screenshot run" is any sequence of 2+ elements — under the same
// parent — whose only meaningful descendant is an <img>, with no
// non-screenshot siblings between them. Mintlify's dev renderer sometimes
// groups the images of one MDX paragraph inside a single wrapper SPAN, and
// sometimes leaves them as separate siblings; we treat both shapes the
// same. We add a small top margin to the 2nd, 3rd, ... member of each run,
// so screenshots that are split by prose (a list, a heading, a paragraph)
// keep their normal spacing.

(function () {
  const GAP_PX = 32; // matches the Tailwind `prose` default for <img> that
                      // dev preview already gives consecutive screenshots;
                      // we apply it explicitly so prod (where <img> sits
                      // inside <picture class="contents"> and loses the
                      // prose margin) gets the same visual gap.
  const CONTENT_SELECTOR = '.mdx-content';

  function applyGap(root) {
    if (!root) return;
    const content = root.matches?.(CONTENT_SELECTOR) ? root : root.querySelector?.(CONTENT_SELECTOR);
    if (!content) return;

    // Process the content element AND every descendant. We start at the
    // content element itself so that runs of consecutive screenshot
    // children directly under `.mdx-content` (e.g. on pages where the
    // renderer doesn't pre-group them) are detected at the top level.
    processElement(content);
    for (const el of content.querySelectorAll('*')) {
      processElement(el);
    }
  }

  function processElement(el) {
    if (el.dataset?.screenshotScopeProcessed) return;
    el.dataset.screenshotScopeProcessed = '1';

    const children = Array.from(el.children);
    if (children.length < 2) return;

    let run = [];
    for (const child of children) {
      if (isScreenshotElement(child)) {
        run.push(child);
      } else {
        flushRun(run);
        run = [];
      }
    }
    flushRun(run);
  }

  function flushRun(run) {
    if (run.length < 2) return;
    for (let i = 1; i < run.length; i++) markGap(run[i]);
  }

  function isScreenshotElement(node) {
    if (!node || node.nodeType !== 1) return false;
    // Must contain at least one <img>.
    const img = node.querySelector?.('img');
    if (!img) return false;
    // Reject anything with text content (e.g. a figure with a caption).
    const text = (node.textContent || '').trim();
    if (text.length > 0) return false;
    // Reject nav/footer/logo/lightbox images by closest container.
    if (node.closest('nav, header, footer, dialog')) return false;
    // Reject icons by class hint.
    const cls = typeof node.className === 'string' ? node.className : '';
    if (/(^|\s)(nav-logo|favicon|icon)(\s|$)/.test(cls)) return false;
    return true;
  }

  function markGap(el) {
    // `el` is one of the leaf screenshot wrappers (e.g. a SPAN whose only
    // meaningful descendant is a single <img>). Mintlify's prod renderer
    // often wraps that <img> in a <picture class="contents"> and gives the
    // outer SPAN `display: contents`, so a CSS margin on `el` itself would
    // be ignored. Find the <img> that belongs to THIS wrapper (not to some
    // sibling wrapper or unrelated subtree) and set the margin there — the
    // <img> is always `display: block` in Mintlify's renderers, so the
    // margin always takes effect.
    const img = el.tagName === 'IMG' ? el : el.querySelector?.('img');
    if (!img) return;
    img.dataset.screenshotGap = 'applied';
    img.style.marginTop = GAP_PX + 'px';
  }

  function run() {
    // Clear the per-element processed marker so re-runs after SPA
    // navigation can re-evaluate (DOM nodes are sometimes reused).
    document.querySelectorAll('[data-screenshot-scope-processed]').forEach((el) => {
      delete el.dataset.screenshotScopeProcessed;
    });
    applyGap(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // Mintlify is a Next.js SPA. Re-run after route changes, debounced via
  // requestAnimationFrame to coalesce the burst of mutations a single nav
  // produces.
  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      run();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
