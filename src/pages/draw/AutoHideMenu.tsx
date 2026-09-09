import React, { useEffect, useRef, useState } from "react";
import style from "./DrawPage.module.less";

const AutoHideMenu: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pointerInside = useRef(false);
  const keyboardFocus = useRef(false);

  function cancelHide() {
    clearTimeout(timer.current);
  }

  function scheduleHide() {
    cancelHide();
    timer.current = setTimeout(() => {
      const focused = document.activeElement;
      // Keep the menu available while editing its title, choosing an export
      // format, or navigating its controls with the keyboard.
      const editing = panel.current?.contains(focused) && (focused?.matches("input, select") || keyboardFocus.current);
      if (!pinned && !pointerInside.current && !editing) setOpen(false);
    }, 650);
  }

  function close() {
    cancelHide();
    setPinned(false);
    setOpen(false);
    if (panel.current?.contains(document.activeElement)) trigger.current?.focus();
  }

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!pinned && !root.current?.contains(event.target as Node)) {
        cancelHide();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelHide();
      document.removeEventListener("pointerdown", outside);
    };
  }, [pinned]);

  return (
    <div
      ref={root}
      className={style.drawer}
      onPointerEnter={event => {
        if (event.pointerType === "touch") return;
        pointerInside.current = true;
        cancelHide();
        setOpen(true);
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        scheduleHide();
      }}
      onPointerDownCapture={() => {
        keyboardFocus.current = false;
      }}
      onFocusCapture={cancelHide}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) scheduleHide();
      }}
      onKeyDown={event => {
        keyboardFocus.current = true;
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        className={style.menuHandle}
        aria-label="画板菜单"
        aria-expanded={open}
        aria-controls="whiteboard-menu"
        title="画板菜单：移入展开，移开自动隐藏"
        onClick={() => {
          cancelHide();
          setOpen(true);
        }}
      >
        <span aria-hidden="true">{open ? "‹" : "›"}</span>
        <span>画板</span>
      </button>
      <div
        ref={panel}
        id="whiteboard-menu"
        role="region"
        aria-label="画板操作"
        aria-hidden={!open}
        className={`${style.toolbar} ${open ? style.toolbarOpen : ""}`}
      >
        <div className={style.drawerHeader}>
          <span>画板菜单</span>
          <button aria-pressed={pinned} onClick={() => setPinned(value => !value)}>
            {pinned ? "取消固定" : "固定显示"}
          </button>
          <button aria-label="收起画板菜单" onClick={close}>
            ‹
          </button>
        </div>
        {children}
        <p className={style.drawerHint}>{pinned ? "菜单已固定，可随时收起" : "移开自动隐藏 · 可固定显示"}</p>
      </div>
    </div>
  );
};

export default AutoHideMenu;
