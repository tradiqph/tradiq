"use client";

import { useEffect } from "react";
import { setupPwaInstall } from "@/lib/pwa-install";

export function PwaBootstrap() {
  useEffect(() => {
    setupPwaInstall();
  }, []);

  return null;
}
