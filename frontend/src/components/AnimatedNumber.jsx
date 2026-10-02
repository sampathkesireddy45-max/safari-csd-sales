import React, { useEffect, useState } from "react";

const AnimatedNumber = ({ value = 0, duration = 800 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }

    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeProgress * (end - start) + start);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(updateCounter);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

export default AnimatedNumber;
