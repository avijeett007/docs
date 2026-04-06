import { useEffect, useRef, useCallback } from 'react';
import { useUserGuide } from '@/context/UserGuideContext';

interface GuideStep {
  element?: string | null;
  intro: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  voice?: string;
}

interface UseIntroGuideOptions {
  steps: GuideStep[];
  onComplete?: () => void;
  onExit?: () => void;
  voiceEnabled?: boolean;
}

export function useIntroGuide({ steps, onComplete, onExit, voiceEnabled = true }: UseIntroGuideOptions) {
  const { isGuideActive, endGuide, currentStep, setCurrentStep } = useUserGuide();
  const introRef = useRef<any | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Voice narration function
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    speechRef.current = new SpeechSynthesisUtterance(text);
    speechRef.current.lang = 'en-US';
    speechRef.current.rate = 0.9;
    speechRef.current.pitch = 1;
    speechRef.current.volume = 0.8;

    window.speechSynthesis.speak(speechRef.current);
  }, [voiceEnabled]);

  useEffect(() => {
    if (!isGuideActive || steps.length === 0) return;



    // Dynamic import of intro.js to avoid SSR issues
    const initializeIntro = async () => {
      const introJs = (await import('intro.js')).default;

      // Initialize intro.js
      introRef.current = introJs();

      // Configure intro.js
      const processedSteps = steps.map((step, index) => {
        const processedStep = {
          ...step,
          step: index + 1,
          position: step.position === 'center' ? 'floating' : step.position,
        };

        // Check if element exists (only warn for missing elements)
        if (step.element && step.element !== null) {
          const element = document.querySelector(step.element);
          if (!element) {
            console.warn(`⚠️ Element not found for step ${index + 1}:`, step.element);
          }
        }

        return processedStep;
      });



      introRef.current.setOptions({
        steps: processedSteps,
        showProgress: true,
        showBullets: true,
        exitOnOverlayClick: true, // Allow clicking outside to exit
        exitOnEsc: true,
        nextLabel: 'Next →',
        prevLabel: '← Back',
        doneLabel: 'Done',
        skipLabel: 'Skip',
        tooltipClass: 'custom-tooltip',
        highlightClass: 'custom-highlight',
        scrollToElement: true,
        scrollPadding: 30,
      });

      // Event handlers
      introRef.current.onbeforechange(() => {
        // Cancel any ongoing speech when changing steps
        window.speechSynthesis.cancel();
        return true;
      });

      introRef.current.onafterchange(() => {
        // Get the current step number - intro.js uses 0-based indexing
        const stepNumber = introRef.current?.currentStep() || 0;
        setCurrentStep(stepNumber);



        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        // Voice narration for current step with a small delay
        setTimeout(() => {
          const currentStepData = steps[stepNumber];
          if (currentStepData?.voice && voiceEnabled) {
            speak(currentStepData.voice);
          } else if (currentStepData?.intro && voiceEnabled) {
            speak(currentStepData.intro);
          }
        }, 300); // Increased delay to ensure speech is cancelled
      });

      introRef.current.oncomplete(() => {
        window.speechSynthesis.cancel();
        endGuide();
        onComplete?.();
      });

      introRef.current.onexit(() => {
        window.speechSynthesis.cancel();
        endGuide();
        onExit?.();
      });

      // Start the intro
      introRef.current.start();
    };

    initializeIntro();

    // Cleanup
    return () => {
      window.speechSynthesis.cancel();
      if (introRef.current) {
        try {
          introRef.current.exit(true);
        } catch (error) {
          console.warn('Error exiting intro.js:', error);
        }
      }

      // Force cleanup of any remaining intro.js elements
      setTimeout(() => {
        const introElements = document.querySelectorAll(
          '.introjs-overlay, .introjs-tooltip, .introjs-helperLayer, .introjs-tooltipReferenceLayer, .introjs-disableInteraction'
        );
        introElements.forEach(el => {
          try {
            el.remove();
          } catch (error) {
            console.warn('Error removing intro.js element:', error);
          }
        });

        // Remove any intro.js classes from body
        document.body.classList.remove('introjs-fixParent');

        // Re-enable any disabled elements
        const disabledElements = document.querySelectorAll('[data-intro-disabled]');
        disabledElements.forEach(el => {
          el.removeAttribute('data-intro-disabled');
          if (el instanceof HTMLElement) {
            el.style.pointerEvents = '';
          }
        });
      }, 100);
    };
  }, [isGuideActive, steps, endGuide, onComplete, onExit, setCurrentStep, voiceEnabled, speak]);

  return {
    intro: introRef.current,
    currentStep,
  };
}