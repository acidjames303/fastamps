import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export default function CallTimer({ startRef }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startRef?.current) return;
    const tick = () => setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startRef?.current]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="inline-flex items-center font-mono text-sm">
      <Clock className="w-4 h-4 mr-1" /> {mm}:{ss}
    </span>
  );
}