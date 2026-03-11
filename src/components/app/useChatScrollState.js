import { useState, useCallback, useEffect, useRef } from 'react';

const DEFAULT_THRESHOLD = 120;

/**
 * Tracks scroll position for chat: atBottom, showJump (scrolled up), newCount, smoothJumpToBottom.
 * Call markNewMessage() when a new message is added and we're not at bottom (increments newCount).
 * Call markSeen() when user scrolls to bottom (clears newCount).
 */
export function useChatScrollState(containerRef, threshold = DEFAULT_THRESHOLD) {
  const [atBottom, setAtBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const newCountRef = useRef(0);

  const checkBottom = useCallback(() => {
    const el = containerRef?.current;
    if (!el) return true;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    return nearBottom;
  }, [containerRef, threshold]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const handleScroll = () => {
      const near = checkBottom();
      setAtBottom(near);
      setShowJump(!near);
      if (near) {
        newCountRef.current = 0;
        setNewCount(0);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, checkBottom]);

  const smoothJumpToBottom = useCallback(() => {
    const el = containerRef?.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    newCountRef.current = 0;
    setNewCount(0);
    setShowJump(false);
    setAtBottom(true);
  }, [containerRef]);

  const markNewMessage = useCallback(() => {
    if (!checkBottom()) {
      newCountRef.current += 1;
      setNewCount((n) => n + 1);
      setShowJump(true);
    }
  }, [checkBottom]);

  const markSeen = useCallback(() => {
    newCountRef.current = 0;
    setNewCount(0);
  }, []);

  return { atBottom, showJump, newCount, smoothJumpToBottom, markNewMessage, markSeen, checkBottom };
}
