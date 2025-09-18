import { map } from "./create-map.js";

export const showSuccessPulse = (lng, lat) => {
  try {
    const pt = map.project([Number(lng), Number(lat)]);
    const rect = map.getCanvas().getBoundingClientRect();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";
    overlay.style.margin = "0";
    overlay.style.padding = "0";
    overlay.style.border = "0";

    const centerX = rect.left + pt.x;
    const centerY = rect.top + pt.y;

    // Soft dark backdrop to ensure visibility on light map tiles
    const backdrop = document.createElement("div");
    backdrop.style.position = "absolute";
    backdrop.style.left = centerX + "px";
    backdrop.style.top = centerY + "px";
    backdrop.style.width = "28px";
    backdrop.style.height = "28px";
    backdrop.style.transform = "translate(-50%, -50%) scale(0.7)";
    backdrop.style.borderRadius = "50%";
    backdrop.style.background = "rgba(0,0,0,0.28)";
    backdrop.style.filter = "blur(1px)";
    backdrop.style.transition = "transform 640ms ease-out, opacity 640ms ease-out";
    backdrop.style.willChange = "transform, opacity";

    const makeRing = ({ size, border, color, startScale, endScale }) => {
      const r = document.createElement("div");
      r.style.position = "absolute";
      r.style.left = centerX + "px";
      r.style.top = centerY + "px";
      r.style.width = size + "px";
      r.style.height = size + "px";
      r.style.transform = `translate(-50%, -50%) scale(${startScale})`;
      r.style.border = `${border}px solid ${color}`;
      r.style.borderRadius = "50%";
      r.style.boxSizing = "border-box";
      r.style.transition = "transform 640ms ease-out, opacity 640ms ease-out";
      r.style.willChange = "transform, opacity";
      requestAnimationFrame(() => {
        r.style.transform = `translate(-50%, -50%) scale(${endScale})`;
        r.style.opacity = "0";
      });
      return r;
    };

    const darkRing = makeRing({ size: 18, border: 2, color: "rgba(0,0,0,0.55)", startScale: 0.9, endScale: 5.6 });
    const lightRing = makeRing({
      size: 18,
      border: 2,
      color: "rgba(255,255,255,0.95)",
      startScale: 0.8,
      endScale: 6.2,
    });

    overlay.appendChild(backdrop);
    overlay.appendChild(darkRing);
    overlay.appendChild(lightRing);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      backdrop.style.transform = "translate(-50%, -50%) scale(1.6)";
      backdrop.style.opacity = "0";
    });

    setTimeout(() => {
      overlay.remove();
    }, 700);
  } catch (e) {
    // ignore
  }
};