"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: "🏆",
    title: "Competitive Tournaments",
    description: "Join daily and weekly tournaments with real prize pools",
  },
  {
    icon: "👥",
    title: "Team Management",
    description: "Create teams, invite friends, and compete together",
  },
  {
    icon: "💰",
    title: "Secure Payments",
    description: "Safe wallet system for entry fees and prize withdrawals",
  },
  {
    icon: "📊",
    title: "Leaderboards",
    description: "Track your progress and climb the ranks",
  },
  {
    icon: "🔔",
    title: "Real-time Updates",
    description: "Get notified about matches, results, and more",
  },
  {
    icon: "💬",
    title: "Tournament Chat",
    description: "Communicate with other players in real-time",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="text-center p-4 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-800 flex-shrink-0 w-[calc(50%-8px)] md:w-auto md:min-w-[280px]">
      <span className="text-3xl sm:text-4xl mb-3 sm:mb-4 block">{feature.icon}</span>
      <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white mb-1 sm:mb-2">
        {feature.title}
      </h3>
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {feature.description}
      </p>
    </div>
  );
}

export default function WhyChooseUs() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Split features into two rows for mobile
  const topRowFeatures = FEATURES.filter((_, i) => i % 2 === 0);
  const bottomRowFeatures = FEATURES.filter((_, i) => i % 2 === 1);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Navigation for mobile carousel
  const maxIndex = Math.ceil(topRowFeatures.length / 1) - 1;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    // Resume auto-scroll after interaction
    setTimeout(() => setIsPaused(false), 3000);
  };

  // Auto-scroll for desktop - continuous marquee effect
  useEffect(() => {
    if (isMobile || isPaused) return;
    
    const scrollContainer = desktopScrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      scrollPosition += scrollSpeed;
      
      // Reset scroll when reaching halfway (since content is duplicated)
      const halfWidth = scrollContainer.scrollWidth / 2;
      if (scrollPosition >= halfWidth) {
        scrollPosition = 0;
      }
      
      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [isMobile, isPaused]);

  // Auto-scroll for mobile
  useEffect(() => {
    if (!isMobile || isPaused) return;
    
    const interval = setInterval(() => {
      goToNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [isMobile, isPaused, goToNext]);

  return (
    <section className="py-12 sm:py-16 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white text-center mb-8 sm:mb-12">
          Why Choose Us?
        </h2>

        {/* Desktop: Continuous auto-scrolling marquee */}
        <div 
          className="hidden md:block"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            ref={desktopScrollRef}
            className="flex gap-6 overflow-x-hidden pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Duplicate features for seamless infinite scroll */}
            {[...FEATURES, ...FEATURES].map((feature, idx) => (
              <div
                key={`desktop-${idx}`}
                className="flex-shrink-0 w-[280px] text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800 hover:shadow-lg hover:scale-105 transition-all duration-300"
              >
                <span className="text-4xl mb-4 block">{feature.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Two rows moving in opposite directions */}
        <div
          className="md:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top row - moves left on next */}
          <div className="overflow-hidden mb-4">
            <div
              className="flex gap-4 transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * 50}%)`,
              }}
            >
              {/* Duplicate features for seamless loop */}
              {[...topRowFeatures, ...topRowFeatures].map((feature, idx) => (
                <FeatureCard key={`top-${idx}`} feature={feature} />
              ))}
            </div>
          </div>

          {/* Bottom row - moves right on next (opposite direction) */}
          <div className="overflow-hidden">
            <div
              className="flex gap-4 transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${(maxIndex - currentIndex) * 50}%)`,
              }}
            >
              {/* Duplicate features for seamless loop */}
              {[...bottomRowFeatures, ...bottomRowFeatures].map((feature, idx) => (
                <FeatureCard key={`bottom-${idx}`} feature={feature} />
              ))}
            </div>
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center mt-6 gap-2">
            {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsPaused(true);
                  setTimeout(() => setIsPaused(false), 3000);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? "bg-orange-500 w-6"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Arrow controls */}
          <div className="flex justify-center mt-4 gap-4">
            <button
              onClick={() => {
                goToPrev();
                setIsPaused(true);
                setTimeout(() => setIsPaused(false), 3000);
              }}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              aria-label="Previous"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => {
                goToNext();
                setIsPaused(true);
                setTimeout(() => setIsPaused(false), 3000);
              }}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              aria-label="Next"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
