"use client";

import { Component, type ReactNode } from "react";

/** True when this browser can create a WebGL context at all (hardware acceleration off, remote desktops and some embedded browsers cannot). */
export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The 3D stage is decoration: if it throws while rendering, the chat must keep working and the poster stays up. */
export class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[zony] el escenario 3D falló, se muestra la imagen fija:", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
