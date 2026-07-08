"use client";

// Installs the console/error ring buffer on mount (see lib/console-capture).
// Renders nothing. Mounted once in the root layout so capture starts on load.
import { useEffect } from "react";
import { installConsoleCapture } from "@/lib/console-capture";

export default function ConsoleCapture() {
  useEffect(() => {
    installConsoleCapture();
  }, []);
  return null;
}
