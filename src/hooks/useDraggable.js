import { useEffect, useRef, useState } from "react";

export default function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragRef.current) {
        return;
      }
      const { startX, startY, startOffset } = dragRef.current;
      setOffset({
        x: startOffset.x + event.clientX - startX,
        y: startOffset.y + event.clientY - startY,
      });
    }

    function handlePointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
    };
  }

  return {
    dragStyle: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
    },
    handlePointerDown,
  };
}
