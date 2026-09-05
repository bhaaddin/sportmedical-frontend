import { useRef, useState, useEffect, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export default function VirtualList<T>({
  items, renderItem, itemHeight, containerHeight, overscan = 5, onEndReached, endReachedThreshold = 100,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
  const visibleItems = items.slice(startIndex, endIndex);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
      if (onEndReached) {
        const { scrollHeight, scrollTop: st, clientHeight } = container;
        if (scrollHeight - st - clientHeight < endReachedThreshold) onEndReached();
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onEndReached, endReachedThreshold]);

  return (
    <div ref={containerRef} style={{ height: containerHeight, overflow: 'auto' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div key={startIndex + index} style={{ position: 'absolute', top: (startIndex + index) * itemHeight, left: 0, right: 0, height: itemHeight }}>
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
}
