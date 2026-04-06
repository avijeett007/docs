import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedHeroProps {
  staticText: string;
  animatedTexts: string[];
  className?: string;
  animationInterval?: number;
}

export function AnimatedHero({ 
  staticText, 
  animatedTexts, 
  className = "",
  animationInterval = 3000 
}: AnimatedHeroProps) {
  const [titleNumber, setTitleNumber] = useState(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === animatedTexts.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, animationInterval);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, animatedTexts, animationInterval]);

  return (
    <h1 className={`text-6xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-tight ${className}`}>
      {staticText}
      <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
        &nbsp;
        {animatedTexts.map((text, index) => (
          <motion.span
            key={index}
            className="absolute font-semibold text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text animate-gradient bg-[length:200%_auto]"
            initial={{ opacity: 0, y: "-100" }}
            transition={{ type: "spring", stiffness: 50 }}
            animate={
              titleNumber === index
                ? {
                    y: 0,
                    opacity: 1,
                  }
                : {
                    y: titleNumber > index ? -150 : 150,
                    opacity: 0,
                  }
            }
          >
            {text}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}
