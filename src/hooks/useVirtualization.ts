import { useState, useEffect, useMemo } from 'react';

interface UseVirtualizationProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualization<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: UseVirtualizationProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    const actualStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: actualStartIndex,
      endIndex,
      visibleItems: items.slice(actualStartIndex, endIndex),
      offsetY: actualStartIndex * itemHeight,
      totalHeight: items.length * itemHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return {
    ...visibleItems,
    handleScroll
  };
}