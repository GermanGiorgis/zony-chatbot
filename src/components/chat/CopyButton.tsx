"use client";

import { useEffect, useRef, useState } from "react";

/** Clipboard write with a fallback for non-secure origins (the dev server opened over the LAN has no navigator.clipboard). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

const icon = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!(await copyText(text))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copiado" : label}
        data-copied={copied}
        className={`group inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.97] ${className}`}
      >
        <span className="relative size-3.5" aria-hidden="true">
          <svg
            {...icon}
            className="absolute inset-0 transition-[opacity,transform,filter] duration-200 ease-out group-data-[copied=true]:scale-75 group-data-[copied=true]:opacity-0 group-data-[copied=true]:blur-[2px]"
          >
            <rect x="9" y="9" width="11" height="11" rx="2.5" />
            <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
          </svg>
          <svg
            {...icon}
            className="absolute inset-0 scale-75 opacity-0 blur-[2px] transition-[opacity,transform,filter] duration-200 ease-out group-data-[copied=true]:scale-100 group-data-[copied=true]:opacity-100 group-data-[copied=true]:blur-none"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        {copied ? "Copiado" : "Copiar"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copiado al portapapeles" : ""}
      </span>
    </>
  );
}
