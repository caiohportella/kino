"use client";

import type {
  ComponentPropsWithoutRef,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function MediaRow({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
}) {
  const dragScroll = useDraggableScroll<HTMLDivElement>();

  return (
    <div
      {...props}
      className={cn(
        "media-row w-full min-w-0 max-w-full cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing",
        className,
      )}
      data-dragging={dragScroll.isDragging ? "true" : "false"}
      onClickCapture={dragScroll.onClickCapture}
      onLostPointerCapture={dragScroll.onLostPointerCapture}
      onPointerCancel={dragScroll.onPointerCancel}
      onPointerDown={dragScroll.onPointerDown}
      onPointerMove={dragScroll.onPointerMove}
      onPointerUp={dragScroll.onPointerUp}
      ref={dragScroll.ref}
    >
      <div className="media-row-track">{children}</div>
    </div>
  );
}

function useDraggableScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    isDragging: false,
    suppressClick: false,
  });

  const [isDragging, setIsDragging] = useState(false);

  function finishDrag(pointerId?: number) {
    if (pointerId !== undefined && dragState.current.pointerId !== pointerId) {
      return;
    }

    const element = ref.current;
    const activePointerId = dragState.current.pointerId;

    if (
      element &&
      activePointerId !== -1 &&
      element.hasPointerCapture(activePointerId)
    ) {
      element.releasePointerCapture(activePointerId);
    }

    if (dragState.current.isDragging) {
      dragState.current.suppressClick = true;

      window.setTimeout(() => {
        dragState.current.suppressClick = false;
      }, 0);
    }

    dragState.current.pointerId = -1;
    dragState.current.isDragging = false;
    setIsDragging(false);
  }

  return {
    ref,
    isDragging,

    onPointerDown(event: ReactPointerEvent<T>) {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }

      /*
       * Do not initiate row dragging from controls or
       * editable content.
       */
      const target = event.target as HTMLElement;

      if (
        target.closest(
          "button, a, input, textarea, select, [contenteditable='true'], [data-prevent-row-drag]",
        )
      ) {
        return;
      }

      const element = ref.current;

      if (!element) {
        return;
      }

      dragState.current.pointerId = event.pointerId;
      dragState.current.startX = event.clientX;
      dragState.current.startScrollLeft = element.scrollLeft;
      dragState.current.isDragging = false;

      setIsDragging(false);
    },

    onPointerMove(event: ReactPointerEvent<T>) {
      if (dragState.current.pointerId !== event.pointerId) {
        return;
      }

      const element = ref.current;

      if (!element) {
        return;
      }

      const distance = event.clientX - dragState.current.startX;

      if (!dragState.current.isDragging && Math.abs(distance) > 6) {
        dragState.current.isDragging = true;
        setIsDragging(true);

        element.setPointerCapture(event.pointerId);
      }

      if (dragState.current.isDragging) {
        element.scrollLeft = dragState.current.startScrollLeft - distance;

        event.preventDefault();
      }
    },

    onPointerUp(event: ReactPointerEvent<T>) {
      finishDrag(event.pointerId);
    },

    onPointerCancel(event: ReactPointerEvent<T>) {
      finishDrag(event.pointerId);
    },

    onLostPointerCapture(event: ReactPointerEvent<T>) {
      finishDrag(event.pointerId);
    },

    onClickCapture(event: ReactMouseEvent<T>) {
      if (!dragState.current.suppressClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
  };
}
