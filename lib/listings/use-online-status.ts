"use client";

import { useEffect, useState } from "react";

/** Client online flag — used to block listing writes offline (no queue). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

export const OFFLINE_SAVE_MESSAGE =
  "Немає з’єднання. Збереження офлайн вимкнено — підключіться до мережі й спробуйте знову.";
