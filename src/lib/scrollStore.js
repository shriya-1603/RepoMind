import { useEffect, useState } from "react";

// Mutable singleton read directly by R3F useFrame (no React re-render on scroll)
export const scroll = { progress: 0, mouseX: 0, mouseY: 0, heroX: 0, cardSideSign: 1 };

const listeners = new Set();
const sideListeners = new Set();
let panelSide = "right"; // side of the detail panel = opposite the hero

export function setScrollProgress(p) {
  scroll.progress = p;
  listeners.forEach((l) => l(p));
}

export function setMouse(x, y) {
  scroll.mouseX = x;
  scroll.mouseY = y;
}

// Hero's normalized screen X (-1 left .. +1 right). Panel/cards go to the opposite side.
export function setHeroX(x) {
  scroll.heroX = x;
  let desired = panelSide;
  if (x > 0.06) desired = "left";
  else if (x < -0.06) desired = "right";
  if (desired !== panelSide) {
    panelSide = desired;
    scroll.cardSideSign = desired === "left" ? -1 : 1;
    sideListeners.forEach((l) => l(desired));
  }
}

export function usePanelSide() {
  const [s, setS] = useState("right");
  useEffect(() => {
    const l = (v) => setS(v);
    sideListeners.add(l);
    return () => sideListeners.delete(l);
  }, []);
  return s;
}

// Lightweight subscription for DOM overlay (fires only during scroll frames via lenis)
export function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const l = (v) => setP(v);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return p;
}

// Feature scroll bands: each card has a center where it fully expands
export const STAGES = [
  { key: "intro", at: 0.0 },
  { key: "overview", at: 0.16 },
  { key: "graph", at: 0.31 },
  { key: "search", at: 0.46 },
  { key: "deps", at: 0.61 },
  { key: "arch", at: 0.76 },
  { key: "chat", at: 0.9 },
  { key: "outro", at: 1.0 },
];

// Returns { index, local } for the currently expanding feature card (0..5) or -1
export function activeCardFromProgress(p) {
  const centers = [0.16, 0.31, 0.46, 0.61, 0.76, 0.9];
  const half = 0.06;
  for (let i = 0; i < centers.length; i++) {
    const d = Math.abs(p - centers[i]);
    if (d < half) {
      return { index: i, local: 1 - d / half };
    }
  }
  return { index: -1, local: 0 };
}
