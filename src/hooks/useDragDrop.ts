import { useState, useCallback, useRef } from 'react';

interface DragItem {
  id: string;
  type: string;
  data: any;
}

interface DropTarget {
  id: string;
  accepts: string[];
  onDrop: (item: DragItem, targetId: string) => void;
}

export function useDragDrop(options: { onDragStart?: (item: DragItem) => void; onDragEnd?: (item: DragItem, dropped: boolean) => void } = {}) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragRef = useRef<DragItem | null>(null);

  const startDrag = useCallback((item: DragItem) => {
    dragRef.current = item;
    setDraggedItem(item);
    options.onDragStart?.(item);
  }, [options.onDragStart]);

  const endDrag = useCallback((dropped = false) => {
    const item = dragRef.current;
    if (item) options.onDragEnd?.(item, dropped);
    dragRef.current = null;
    setDraggedItem(null);
    setDragOverTarget(null);
  }, [options.onDragEnd]);

  const dragOver = useCallback((targetId: string) => setDragOverTarget(targetId), []);
  const dragLeave = useCallback(() => setDragOverTarget(null), []);

  const drop = useCallback((target: DropTarget) => {
    if (!draggedItem) return false;
    if (target.accepts.includes(draggedItem.type)) {
      target.onDrop(draggedItem, target.id);
      endDrag(true);
      return true;
    }
    return false;
  }, [draggedItem, endDrag]);

  return { draggedItem, dragOverTarget, isDragging: !!draggedItem, startDrag, endDrag, dragOver, dragLeave, drop };
}

export function useDragHandle(onDragStart: () => void) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    onDragStart();
  }, [onDragStart]);

  const handleTouchStart = useCallback(() => onDragStart(), [onDragStart]);

  return { onMouseDown: handleMouseDown, onTouchStart: handleTouchStart };
}
