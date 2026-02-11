import { useCallback } from "react";
import type { KeyboardEvent } from "react";

export function useDropdownKeyboard(
  itemCount: number,
  focusedIndex: number,
  setFocusedIndex: (i: number) => void,
  onSelect: (index: number) => void,
  onClose: () => void,
) {
  return useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(focusedIndex < itemCount - 1 ? focusedIndex + 1 : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(focusedIndex > 0 ? focusedIndex - 1 : itemCount - 1);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(itemCount - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(focusedIndex);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [itemCount, focusedIndex, setFocusedIndex, onSelect, onClose]);
}
