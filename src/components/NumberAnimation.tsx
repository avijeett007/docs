import React, { useEffect, useState, useRef } from 'react';

interface NumberAnimationProps {
  value: number;
  duration?: number;
  className?: string;
}

const NumberAnimation: React.FC<NumberAnimationProps> = ({ 
  value, 
  duration = 1000,
  className = ""
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationFrame = useRef(0);
  const startTime = useRef(0);

  useEffect(() => {
    if (previousValue.current === value) return;

    const startValue = previousValue.current;
    const endValue = value;
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4); // Easing function for smooth deceleration
      
      const currentValue = Math.round(
        startValue + (endValue - startValue) * easeOutQuart
      );
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
        startTime.current = 0;
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      ${displayValue}
    </span>
  );
};

export default NumberAnimation;
