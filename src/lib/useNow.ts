import { useEffect, useState } from 'react';

/** الوقت الحالي، يتحدّث دورياً حتى تتغير «المحاضرة الحالية» والمواعيد دون إعادة فتح الشاشة. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
