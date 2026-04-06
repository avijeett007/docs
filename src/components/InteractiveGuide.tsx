'use client';

import React, { useState, useEffect, useCallback } from 'react';
import introJs from 'intro.js';
import { useUserGuide } from '@/context/UserGuideContext';
import { userGuideSteps } from '@/config/userGuideSteps';
import '@/styles/intro-custom.css';

interface InteractiveGuideProps {
  section: 'sidebar' | 'dashboard' | 'ai-agents';
  onSectionComplete?: () => void;
}

export default function InteractiveGuide({ section, onSectionComplete }: InteractiveGuideProps) {
  const { isGuideActive, endGuide } = useUserGuide();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [intro, setIntro] = useState<ReturnType<typeof introJs> | null>(null);

  const steps = userGuideSteps[section]?.steps || [];

  // Voice narration function
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Custom button renderer for interactive options
  const addCustomButtons = useCallback(() => {
    const tooltipButtons = document.querySelector('.introjs-tooltipbuttons');
    if (!tooltipButtons) return;

    // Remove default next button for interactive steps
    const nextButton = tooltipButtons.querySelector('.introjs-nextbutton');
    if (nextButton && currentStepIndex > 0) {
      nextButton.remove();
    }

    // Add custom buttons
    const customButtonsContainer = document.createElement('div');
    customButtonsContainer.style.cssText = 'display: inline-flex; gap: 8px; margin-left: 8px;';

    // Learn More button
    const learnMoreBtn = document.createElement('button');
    learnMoreBtn.textContent = '📚 Learn More';
    learnMoreBtn.className = 'introjs-button custom-learn-more';
    learnMoreBtn.style.cssText = 'background-color: #8b5cf6 !important;';
    learnMoreBtn.onclick = () => {
      setIsDetailMode(true);
      speak('Let me tell you more about this section.');
      // You can add more detailed content here
      setTimeout(() => {
        speak(steps[currentStepIndex]?.voice || steps[currentStepIndex]?.intro || '');
      }, 1500);
    };

    // Next Section button
    const nextSectionBtn = document.createElement('button');
    nextSectionBtn.textContent = 'Next Section →';
    nextSectionBtn.className = 'introjs-button custom-next-section';
    nextSectionBtn.onclick = () => {
      if (intro) {
        intro.nextStep();
      }
    };

    if (currentStepIndex > 0 && !isDetailMode) {
      customButtonsContainer.appendChild(learnMoreBtn);
    }
    
    if (currentStepIndex > 0) {
      customButtonsContainer.appendChild(nextSectionBtn);
    }

    // Find the skip button and insert custom buttons after it
    const skipButton = tooltipButtons.querySelector('.introjs-skipbutton');
    if (skipButton && skipButton.parentNode) {
      skipButton.parentNode.insertBefore(customButtonsContainer, skipButton.nextSibling);
    }
  }, [currentStepIndex, isDetailMode, intro, speak, steps]);

  useEffect(() => {
    if (!isGuideActive || steps.length === 0) return;

    const instance = introJs();
    setIntro(instance);

    // Configure intro.js
    instance.setOptions({
      steps: steps.map((step: any, index: number) => ({
        ...step,
        step: index + 1,
        position: step.position as 'top' | 'bottom' | 'left' | 'right' | 'auto' | undefined,
      })),
      showProgress: true,
      showBullets: true,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      nextLabel: 'Click to Continue',
      prevLabel: '← Back',
      doneLabel: 'Finish',
      skipLabel: 'Exit Tour',
      tooltipClass: 'custom-tooltip',
      highlightClass: 'custom-highlight',
      scrollToElement: true,
      scrollPadding: 30,
      disableInteraction: false, // Allow interaction with highlighted elements
    });

    // Event handlers
    instance.onbeforechange(function() {
      window.speechSynthesis.cancel();
      setIsDetailMode(false);
      return true; // Allow the transition
    });

    instance.onafterchange(function(targetElement) {
      const stepNumber = instance.currentStep() || 0;
      setCurrentStepIndex(stepNumber);
      
      // Add custom buttons after tooltip renders
      setTimeout(addCustomButtons, 100);

      // Voice narration
      const currentStepData = steps[stepNumber];
      if (stepNumber === 0) {
        // Welcome message
        speak(currentStepData?.voice || currentStepData?.intro || '');
      } else {
        // Interactive prompt
        speak(`Click on the ${currentStepData?.intro?.split(' ')[0] || 'highlighted'} menu to explore it, or choose an option below.`);
      }
    });

    instance.oncomplete(() => {
      window.speechSynthesis.cancel();
      speak('Great job! You\'ve completed this section of the tour.');
      endGuide();
      onSectionComplete?.();
    });

    instance.onexit(() => {
      window.speechSynthesis.cancel();
      endGuide();
    });

    // Note: intro.js doesn't have a built-in click handler for highlighted elements
    // Users can still click "Next Section" or use navigation buttons

    // Start the intro
    instance.start();

    // Initial narration
    setTimeout(() => {
      const firstStep = steps[0];
      if (firstStep?.voice) {
        speak(firstStep.voice);
      } else if (firstStep?.intro) {
        speak(firstStep.intro);
      }
    }, 100);

    return () => {
      window.speechSynthesis.cancel();
      if (instance) {
        instance.exit(true);
      }
    };
  }, [isGuideActive, steps, endGuide, onSectionComplete, speak, addCustomButtons]);

  return null;
}