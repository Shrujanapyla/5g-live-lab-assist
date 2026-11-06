import { useRef, useState } from 'react';
import RoiViewport from './RoiViewport';
import RoiNotes from './RoiNotes';
import SnapshotHistory from './SnapshotHistory';

import {
  clamp,
  clampLayout,
  formatTimestamp,
  readFileAsDataUrl,
  MIN_W,
  MIN_H,
} from '../utils';

/**
 * One independent ROI panel:
 * draggable, resizable, independent zoom/pan,
 * label, notes and snapshot history.
 */
export default function RoiPanel({
  roi,
  bounds,
  compact,
  focused,
  dispatch,
  onCapture,
  onRemove,
  onRestoreSnapshot,
}) {
  const [drawer, setDrawer] = useState('notes');

  const fileRef = useRef(null);
  const drag = useRef(null);
  const resize = useRef(null);

  const layout = compact
    ? null
    : clampLayout(roi.layout, bounds);

  const active =
    roi.snapshots.find(
      (snapshot) => snapshot.id === roi.activeSnapshotId
    ) ?? null;

  const focus = () =>
    dispatch({
      type: 'FOCUS',
      id: roi.id,
    });

  // Reposition panel.
  const startDrag = (event) => {
    if (
      compact ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    drag.current = {
      px: event.clientX,
      py: event.clientY,
      ...layout,
    };

    focus();
  };

  const moveDrag = (event) => {
    const current = drag.current;

    if (!current) return;

    dispatch({
      type: 'LAYOUT',
      id: roi.id,
      layout: {
        x: clamp(
          current.x + event.clientX - current.px,
          0,
          Math.max(0, bounds.w - current.w)
        ),
        y: clamp(
          current.y + event.clientY - current.py,
          0,
          Math.max(0, bounds.h - current.h)
        ),
      },
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  // Resize panel.
  const startResize = (event) => {
    if (compact) return;

    event.stopPropagation();

    event.currentTarget.setPointerCapture(event.pointerId);

    resize.current = {
      px: event.clientX,
      py: event.clientY,
      ...layout,
    };

    focus();
  };

  const moveResize = (event) => {
    const current = resize.current;

    if (!current) return;

    dispatch({
      type: 'LAYOUT',
      id: roi.id,
      layout: {
        w: clamp(
          current.w + event.clientX - current.px,
          MIN_W,
          Math.max(MIN_W, bounds.w - current.x)
        ),
        h: clamp(
          current.h + event.clientY - current.py,
          MIN_H,
          Math.max(MIN_H, bounds.h - current.y)
        ),
      },
    });
  };

  const endResize = () => {
    resize.current = null;
  };

  // Keyboard movement and resizing.
  const onGripKey = (event) => {
    if (compact) return;

    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];

    if (!direction) return;

    event.preventDefault();

    const step = 12;

    if (event.shiftKey) {
      dispatch({
        type: 'LAYOUT',
        id: roi.id,
        layout: clampLayout(
          {
            ...layout,
            w: layout.w + direction[0] * step,
            h: layout.h + direction[1] * step,
          },
          bounds
        ),
      });
    } else {
      dispatch({
        type: 'LAYOUT',
        id: roi.id,
        layout: clampLayout(
          {
            ...layout,
            x: layout.x + direction[0] * step,
            y: layout.y + direction[1] * step,
          },
          bounds
        ),
      });
    }
  };

  // Capture or upload a snapshot.
  const capture = async () => {
    if (onCapture) {
      const src = await onCapture(roi);

      if (src) {
        dispatch({
          type: 'ADD_SNAPSHOT',
          id: roi.id,
          src,
        });
      }
    } else {
      fileRef.current?.click();
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    const src = await readFileAsDataUrl(file);

    dispatch({
      type: 'ADD_SNAPSHOT',
      id: roi.id,
      src,
    });
  };

  // Restore selected version.
  const handleRestore = (snapshotId) => {
    const selected = roi.snapshots.find(
      (snapshot) => snapshot.id === snapshotId
    );

    if (!selected) return;

    if (onRestoreSnapshot && selected.snapshotId) {
      onRestoreSnapshot(roi, selected);
      return;
    }

    dispatch({
      type: 'RESTORE',
      id: roi.id,
      snapshotId,
    });
  };

  // Panel styling.
  const panelStyle = compact
    ? undefined
    : {
        left: layout.x,
        top: layout.y,
        width: layout.w,
        height: layout.h,
        zIndex: roi.z,
      };

  return (
    <section
      className={`mrw-panel${focused ? ' is-focused' : ''}`}
      style={panelStyle}
      onPointerDown={focus}
      aria-label={`ROI panel: ${roi.label}`}
    >
      <header
        className="mrw-panel__header"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {!compact && (
          <button
            type="button"
            className="mrw-grip"
            onKeyDown={onGripKey}
            aria-label="Move panel with arrow keys; shift and arrows to resize"
          >
            ::
          </button>
        )}

        <input
          className="mrw-label"
          value={roi.label}
          onChange={(event) =>
            dispatch({
              type: 'META',
              id: roi.id,
              patch: {
                label: event.target.value,
              },
            })
          }
          aria-label="ROI label"
        />

        <button
          type="button"
          className="mrw-icon-btn"
          onClick={() => onRemove?.()}
          aria-label="Remove ROI"
        >
          X
        </button>
      </header>

      <div className="mrw-panel__time">
        Captured: {formatTimestamp(active?.capturedAt)}
      </div>

      <RoiViewport
        src={active?.src}
        alt={roi.label}
        view={roi.view}
        onViewChange={(view) =>
          dispatch({
            type: 'VIEW',
            id: roi.id,
            view,
          })
        }
      />

      <div className="mrw-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={drawer === 'notes'}
          className={drawer === 'notes' ? 'is-on' : ''}
          onClick={() =>
            setDrawer(drawer === 'notes' ? null : 'notes')
          }
        >
          Notes{roi.note ? ' *' : ''}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={drawer === 'history'}
          className={drawer === 'history' ? 'is-on' : ''}
          onClick={() =>
            setDrawer(drawer === 'history' ? null : 'history')
          }
        >
          History ({roi.snapshots.length})
        </button>

        <button
          type="button"
          className="mrw-tabs__action"
          onClick={capture}
        >
          + Snapshot
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFile}
        />
      </div>

      {drawer === 'notes' && (
        <RoiNotes
          note={roi.note}
          updatedAt={roi.noteUpdatedAt}
          onChange={(note) =>
            dispatch({
              type: 'META',
              id: roi.id,
              patch: { note },
            })
          }
        />
      )}

      {drawer === 'history' && (
        <SnapshotHistory
          snapshots={roi.snapshots}
          activeId={roi.activeSnapshotId}
          onRestore={handleRestore}
        />
      )}

      {!compact && (
        <div
          className="mrw-resize"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-hidden="true"
        />
      )}
    </section>
  );
}