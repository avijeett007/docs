/**
 * Utility functions for cleaning up intro.js elements and restoring normal navigation
 */

export function forceCleanupIntroJs(): void {
  try {
    // Cancel any ongoing speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Remove all intro.js related elements
    const introSelectors = [
      '.introjs-overlay',
      '.introjs-tooltip',
      '.introjs-helperLayer',
      '.introjs-tooltipReferenceLayer',
      '.introjs-disableInteraction',
      '.introjs-showElement',
      '.introjs-relativePosition',
      '.introjs-fixedTooltip',
      '.introjs-floating'
    ];

    introSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        try {
          el.remove();
        } catch (error) {
          console.warn(`Error removing intro.js element ${selector}:`, error);
        }
      });
    });

    // Remove intro.js classes from body and html
    if (document.body) {
      document.body.classList.remove(
        'introjs-fixParent',
        'introjs-showElement',
        'introjs-donebutton',
        'introjs-skipbutton'
      );
    }

    if (document.documentElement) {
      document.documentElement.classList.remove('introjs-fixParent');
    }

    // Re-enable any disabled elements
    const disabledElements = document.querySelectorAll('[data-intro-disabled]');
    disabledElements.forEach(el => {
      el.removeAttribute('data-intro-disabled');
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = '';
        el.style.position = '';
        el.style.zIndex = '';
      }
    });

    // Remove any intro.js data attributes that might interfere
    const elementsWithIntroData = document.querySelectorAll('[data-intro], [data-step], [data-position]');
    elementsWithIntroData.forEach(el => {
      // Don't remove the data attributes as they might be needed for future guides
      // Just ensure they don't have any blocking styles
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = '';
        el.style.position = '';
        el.style.zIndex = '';
      }
    });

    // Force remove any remaining overlays by checking for elements with high z-index
    const highZIndexElements = Array.from(document.querySelectorAll('*')).filter(el => {
      if (el instanceof HTMLElement) {
        const zIndex = window.getComputedStyle(el).zIndex;
        return zIndex && parseInt(zIndex) > 9999;
      }
      return false;
    });

    highZIndexElements.forEach(el => {
      if (el instanceof HTMLElement && el.className.includes('introjs')) {
        try {
          el.remove();
        } catch (error) {
          console.warn('Error removing high z-index intro.js element:', error);
        }
      }
    });

    console.log('Intro.js cleanup completed');
  } catch (error) {
    console.error('Error during intro.js cleanup:', error);
  }
}

/**
 * Add this to window for debugging purposes
 */
if (typeof window !== 'undefined') {
  (window as any).forceCleanupIntroJs = forceCleanupIntroJs;
}
