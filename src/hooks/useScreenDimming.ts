import { useEffect, useRef, useState, useCallback } from 'react';

interface DimmingState {
  isDimmed: boolean;
  isLocked: boolean;
}

const INACTIVITY_TIMEOUT = 10000; // 10 giây
const SWIPE_THRESHOLD = 50; // Minimum swipe distance in pixels to unlock

// Check if device supports touch (mobile/tablet)
function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function useScreenDimming() {
  const [state, setState] = useState<DimmingState>({ isDimmed: false, isLocked: false });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isLockedRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  
  // Only enable dimming on touch devices (mobile/tablet)
  const isMobile = isTouchDevice();

  // Keep ref in sync with state
  useEffect(() => {
    isLockedRef.current = state.isLocked;
  }, [state.isLocked]);

  const dim = useCallback(() => {
    console.log('🔒 Dimming screen...');
    setState({ isDimmed: true, isLocked: true });
    // Tạo overlay tối để giảm độ sáng màn hình xuống 5%
    if (!overlayRef.current) {
      overlayRef.current = document.createElement('div');
      overlayRef.current.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.95);
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      overlayRef.current.innerHTML = '<p style="color: rgba(255,255,255,0.4); font-size: 12px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 20px;">⬆️ Vuốt lên để mở khóa</p>';
      document.body.appendChild(overlayRef.current);
    }
    overlayRef.current.style.opacity = '1';
  }, []);

  const undim = useCallback(() => {
    console.log('🔓 Undimming screen...');
    setState({ isDimmed: false, isLocked: false });
    lastActivityRef.current = Date.now();
    if (overlayRef.current) {
      overlayRef.current.style.opacity = '0';
      setTimeout(() => {
        if (overlayRef.current && document.body.contains(overlayRef.current)) {
          document.body.removeChild(overlayRef.current);
          overlayRef.current = null;
        }
      }, 300);
    }
  }, []);

  const resetTimer = useCallback(() => {
    // Only reset if not locked
    if (!isLockedRef.current) {
      lastActivityRef.current = Date.now();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(dim, INACTIVITY_TIMEOUT);
    }
  }, [dim]);

  // Check if the swipe is valid
  const isValidSwipe = useCallback((startX: number, startY: number, endX: number, endY: number): boolean => {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Must swipe up (negative Y = moving up) with sufficient distance
    if (deltaY > -10) return false;
    if (distance < SWIPE_THRESHOLD) return false;
    
    return true;
  }, []);

  useEffect(() => {
    // Skip on desktop - only enable on touch devices
    if (!isMobile) {
      console.log('💻 ScreenDimming: Disabled on desktop');
      return;
    }
    
    console.log('� ScreenDimming: Setting up listeners...');
    
    // Reset timer on mount
    resetTimer();

    // Check periodically if we should dim (in case we missed events)
    const intervalId = setInterval(() => {
      if (!isLockedRef.current) {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
          dim();
        }
      }
    }, 1000);

    // Handle user activity - reset timer
    const handleActivity = () => {
      if (!isLockedRef.current) {
        resetTimer();
      }
    };

    // Track touch start for swipe detection
    const handleTouchStart = (e: TouchEvent) => {
      if (isLockedRef.current && e.touches.length > 0) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    };

    // Handle swipe to unlock
    const handleTouchMove = (e: TouchEvent) => {
      if (isLockedRef.current && touchStartRef.current && e.touches.length > 0) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        
        if (isValidSwipe(touchStartRef.current.x, touchStartRef.current.y, currentX, currentY)) {
          console.log('✅ Valid swipe detected!');
          undim();
          touchStartRef.current = null;
        }
      }
    };

    // Handle touch end to reset touch start
    const handleTouchEnd = () => {
      touchStartRef.current = null;
    };

    // Handle mouse events for testing on desktop
    const handleMouseDown = (e: MouseEvent) => {
      if (isLockedRef.current) {
        touchStartRef.current = {
          x: e.clientX,
          y: e.clientY
        };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isLockedRef.current && touchStartRef.current) {
        if (isValidSwipe(touchStartRef.current.x, touchStartRef.current.y, e.clientX, e.clientY)) {
          console.log('✅ Valid mouse swipe detected!');
          undim();
          touchStartRef.current = null;
        }
      }
    };

    const handleMouseUp = () => {
      touchStartRef.current = null;
    };

    // Add event listeners
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touch', handleActivity, { passive: true });

    return () => {
      console.log('📱 ScreenDimming: Cleaning up...');
      clearInterval(intervalId);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touch', handleActivity);
      if (overlayRef.current && document.body.contains(overlayRef.current)) {
        document.body.removeChild(overlayRef.current);
      }
    };
  }, [resetTimer, isValidSwipe, undim, dim]);

  // Return state even when disabled (for compatibility)
  return state;
}
