import { useEffect, useRef } from 'react';
import { clamp, zoomAt, MIN_SCALE, MAX_SCALE } from '../utils';

/** Zoomable / pannable image viewport. Wheel, drag, pinch, buttons, double-click to reset. */
export default function RoiViewport({ src, alt, view, onViewChange }) {
  const ref = useRef(null);
  const viewRef = useRef(view);
  const cbRef = useRef(onViewChange);
  const pointers = useRef(new Map());
  const prev = useRef(null);
  viewRef.current = view;
  cbRef.current = onViewChange;

  const local = (clientX, clientY) => {
    const r = ref.current.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  // Non-passive wheel listener so we can preventDefault page scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const { x, y } = local(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      cbRef.current(zoomAt(viewRef.current, x, y, factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const gestureState = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) return { mid: pts[0], dist: 0 };
    const [a, b] = pts;
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    prev.current = gestureState();
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    const next = gestureState();
    const p = prev.current;
    if (!p) return;
    let v = viewRef.current;
    if (pointers.current.size >= 2 && p.dist > 0) {
      v = zoomAt(v, next.mid.x, next.mid.y, next.dist / p.dist);
    }
    v = { ...v, tx: v.tx + (next.mid.x - p.mid.x), ty: v.ty + (next.mid.y - p.mid.y) };
    prev.current = next;
    cbRef.current(v);
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    prev.current = pointers.current.size ? gestureState() : null;
  };

  const zoomBy = (factor) => {
    const r = ref.current.getBoundingClientRect();
    onViewChange(zoomAt(view, r.width / 2, r.height / 2, factor));
  };
  const reset = () => onViewChange({ scale: 1, tx: 0, ty: 0 });

  return (
    <div
      ref={ref}
      className="mrw-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
    >
      {src ? (
        <div
          className="mrw-viewport__content"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
        >
          <img src={src} alt={alt} draggable={false} />
        </div>
      ) : (
        <div className="mrw-viewport__empty">No snapshot</div>
      )}
      <div className="mrw-zoom" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} disabled={view.scale <= MIN_SCALE} aria-label="Zoom out">−</button>
        <span aria-live="polite">{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.25)} disabled={view.scale >= MAX_SCALE} aria-label="Zoom in">+</button>
        <button type="button" onClick={reset} aria-label="Reset view">⟲</button>
      </div>
    </div>
  );
}
