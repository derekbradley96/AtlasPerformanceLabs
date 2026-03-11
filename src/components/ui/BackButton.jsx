import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BackButton({ className = '' }) {
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    // Only enable swipe gesture on mobile
    if (window.innerWidth > 768) return;

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      
      // Only start tracking if touch starts near left edge (within 30px)
      if (touchStartX.current < 30) {
        isSwiping.current = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isSwiping.current) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - touchStartX.current;
      const deltaY = Math.abs(touchY - touchStartY.current);

      // If vertical movement is greater than horizontal, cancel swipe
      if (deltaY > 50) {
        isSwiping.current = false;
        return;
      }

      // Trigger back if swiped right more than 100px
      if (deltaX > 100) {
        isSwiping.current = false;
        handleBack();
      }
    };

    const handleTouchEnd = () => {
      isSwiping.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className={`text-slate-400 hover:text-white hover:bg-slate-800 ${className}`}
    >
      <ChevronLeft className="w-5 h-5" />
    </Button>
  );
}