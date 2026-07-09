"use client";

import * as React from "react";
import { AppSidebar } from "@/components/sidebarcomponents/app-sidebar";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "foldex.sidebar.width";

function clampSidebarWidth(value: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

function SidebarDragHandle({
  isDragging,
  onResizeStart,
}: {
  isDragging: boolean;
  onResizeStart: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const { state, isMobile } = useSidebar();

  // Hide the drag handle if on mobile OR if the sidebar is collapsed
  if (isMobile || state === "collapsed") return null;

  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      onPointerDown={onResizeStart}
      className={cn(
        "fixed inset-y-2 left-[calc(var(--sidebar-width)-6px)] z-40 hidden w-3 cursor-col-resize md:block",
        "after:absolute after:inset-y-8 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-border/50 after:transition-colors",
        "hover:after:bg-primary/50",
        isDragging && "after:bg-primary"
      )}
    >
      <span className="sr-only">Resize sidebar</span>
    </button>
  );
}

export function ResizableSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStateRef = React.useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  React.useEffect(() => {
    const storedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);

    if (!storedWidth) return;

    const parsedWidth = Number(storedWidth);
    if (!Number.isNaN(parsedWidth)) {
      setSidebarWidth(clampSidebarWidth(parsedWidth));
    }
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const nextWidth = clampSidebarWidth(
        dragState.startWidth + event.clientX - dragState.startX
      );

      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  React.useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampSidebarWidth(sidebarWidth))
    );
  }, [sidebarWidth]);

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isMobile) return;

    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsDragging(true);
  };

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        !isMobile
          ? ({
              "--sidebar-width": `${sidebarWidth}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
          <AppSidebar variant="inset" />
          <SidebarDragHandle 
        isDragging={isDragging} 
        onResizeStart={handleResizeStart} 
      />
          <SidebarInset className="overflow-y-auto">
            {children}
            <Toaster />
          </SidebarInset>

    </SidebarProvider>
  );
}