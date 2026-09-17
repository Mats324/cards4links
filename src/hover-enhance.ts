import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type PluginValue,
  type ViewUpdate,
} from "@codemirror/view";
import { setIcon } from "obsidian";
import { extractUrlFromLink, lineUrlRegex, linkLineRegex } from "./utils";
import { t } from "./i18n";

export interface HoverConvertPayload {
  url: string;
  line: number;
  fromCh: number;
  toCh: number;
}

const SHOW_DELAY_MS = 150;
const HIDE_DELAY_MS = 150;
const POPOVER_MARGIN = 16;
const POPOVER_OFFSET = 6;

const hoverUrlRegex = new RegExp(
  `${linkLineRegex.source}|${lineUrlRegex.source}`,
  "gi"
);

const urlMarkDecoration = Decoration.mark({ class: "cards4links-hover-url" });

export function hoverEnhanceExtension(
  enabled: () => boolean,
  getTooltipDurationMs: () => number,
  onConvert: (payload: HoverConvertPayload) => void
): Extension {
  return ViewPlugin.fromClass(
    class HoverEnhancePlugin implements PluginValue {
      view: EditorView;
      decorations: DecorationSet;
      private matcher: MatchDecorator;
      private popover: HTMLElement | null = null;
      private payload: HoverConvertPayload | null = null;
      private activeSpan: HTMLElement | null = null;
      private showTimer = -1;
      private hideTimer = -1;
      private shownAt = -1;
      private lastClientX = -1;
      private lastClientY = -1;

      constructor(view: EditorView) {
        this.view = view;
        this.matcher = new MatchDecorator({
          regexp: hoverUrlRegex,
          decorate: (add, from, to, match) => {
            const isLink = match[0].charAt(0) === "[";
            if (isLink && !extractUrlFromLink(match[0])) return;
            add(from, to, urlMarkDecoration);
          },
        });
        this.decorations = this.matcher.createDeco(view);
        view.scrollDOM.addEventListener("scroll", this.onScroll);
      }

      update(update: ViewUpdate): void {
        this.decorations = this.matcher.updateDeco(update, this.decorations);
        if (update.docChanged) {
          this.hardHide();
          return;
        }
        if (!update.geometryChanged || !this.popover) return;
        if (!this.positionPopover(this.popover)) this.hide();
      }

      destroy(): void {
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.hardHide();
      }

      private readonly onScroll = (): void => {
        if (!this.popover) return;
        if (!this.positionPopover(this.popover)) this.hide();
      };

      handleMousemove(event: MouseEvent): void {
        this.lastClientX = event.clientX;
        this.lastClientY = event.clientY;
        if (!enabled()) {
          this.hardHide();
          return;
        }
        const span = this.urlSpanFromEvent(event);
        if (span) {
          if (span !== this.activeSpan) {
            this.activeSpan = span;
            const pos = this.view.posAtCoords({
              x: event.clientX,
              y: event.clientY,
            });
            this.payload = pos == null ? null : this.findPayload(pos);
            if (!this.payload) {
              this.activeSpan = null;
              return;
            }
            this.prepareShow();
          } else {
            this.cancelHideTimer();
          }
          return;
        }
        this.activeSpan = null;
        if (this.popover && this.isOverPopover(event.clientX, event.clientY)) {
          this.cancelHideTimer();
          return;
        }
        this.scheduleHide();
      }

      handleMouseleave(): void {
        this.scheduleHide();
      }

      private urlSpanFromEvent(event: MouseEvent): HTMLElement | null {
        let node = event.target as Node | null;
        if (!node) return null;
        if (!node.instanceOf(Element)) node = node.parentElement;
        if (!node || !node.instanceOf(Element)) return null;
        const el = node.closest(".cards4links-hover-url");
        return el && el.instanceOf(HTMLElement) ? el : null;
      }

      private isOverPopover(clientX: number, clientY: number): boolean {
        const el = this.popover;
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
          clientX >= rect.left - POPOVER_MARGIN &&
          clientX <= rect.right + POPOVER_MARGIN &&
          clientY >= rect.top - POPOVER_MARGIN &&
          clientY <= rect.bottom + POPOVER_MARGIN
        );
      }

      private findPayload(pos: number): HoverConvertPayload | null {
        const line = this.view.state.doc.lineAt(pos);
        const text = this.view.state.doc.sliceString(line.from, line.to);

        for (const match of text.matchAll(linkLineRegex)) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          if (pos >= line.from + start && pos <= line.from + end) {
            const url = extractUrlFromLink(match[0]);
            if (url) {
              return {
                url,
                line: line.number - 1,
                fromCh: start,
                toCh: end,
              };
            }
            break;
          }
        }
        for (const match of text.matchAll(lineUrlRegex)) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          if (pos >= line.from + start && pos <= line.from + end) {
            return {
              url: match[0],
              line: line.number - 1,
              fromCh: start,
              toCh: end,
            };
          }
        }
        return null;
      }

      private prepareShow(): void {
        if (!this.payload) return;
        this.cancelHideTimer();
        if (this.showTimer >= 0) {
          window.clearTimeout(this.showTimer);
        }
        this.showTimer = window.setTimeout(() => {
          this.showTimer = -1;
          this.showPopover();
        }, SHOW_DELAY_MS);
      }

      private scheduleHide(): void {
        if (this.hideTimer >= 0) return;
        this.hideTimer = window.setTimeout(() => {
          this.hideTimer = -1;
          this.hide();
        }, HIDE_DELAY_MS);
      }

      private cancelHideTimer(): void {
        if (this.hideTimer >= 0) {
          window.clearTimeout(this.hideTimer);
          this.hideTimer = -1;
        }
      }

      private clearTimers(): void {
        this.cancelHideTimer();
        if (this.showTimer >= 0) {
          window.clearTimeout(this.showTimer);
          this.showTimer = -1;
        }
      }

      private showPopover(): void {
        if (!this.payload || !this.activeSpan) return;
        this.removePopover();

        const popover = createDiv({ cls: "cards4links-hover-tooltip" });
        const button = popover.createEl("button", {
          cls: "cards4links-hover-convert",
        });
        setIcon(button, "wand-2");
        button.createSpan({ text: t("hover.convertButton") });

        button.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.view.focus();
          const payload = this.payload;
          this.removePopover();
          if (payload) onConvert(payload);
        });

        this.view.dom.appendChild(popover);
        this.popover = popover;
        if (!this.positionPopover(popover)) {
          this.hardHide();
          return;
        }
        this.shownAt = Date.now();
      }

      private positionPopover(popover: HTMLElement): boolean {
        const payload = this.payload;
        if (!payload) return false;
        const line = this.view.state.doc.line(payload.line);
        const from = Math.min(line.from + payload.fromCh, line.to);
        const to = Math.max(from, Math.min(line.from + payload.toCh, line.to));
        const fromRect = this.view.coordsAtPos(from, -1);
        const toRect = this.view.coordsAtPos(to, 1);
        if (!fromRect || !toRect) return false;

        const editorRect = this.view.dom.getBoundingClientRect();
        const offsetParent = popover.offsetParent;
        const base = offsetParent
          ? offsetParent.getBoundingClientRect()
          : editorRect;

        const center = (fromRect.left + toRect.right) / 2;
        const width = popover.offsetWidth;
        const height = popover.offsetHeight;

        let left = center - base.left - width / 2;
        const minLeft = editorRect.left - base.left + POPOVER_MARGIN;
        const maxLeft = editorRect.right - base.left - width - POPOVER_MARGIN;
        if (maxLeft < minLeft) {
          left = editorRect.left - base.left + POPOVER_MARGIN;
        } else {
          left = Math.max(minLeft, Math.min(left, maxLeft));
        }

        const belowTop = toRect.bottom - base.top + POPOVER_OFFSET;
        const belowFits =
          belowTop + height <= editorRect.bottom - base.top - POPOVER_MARGIN;
        const top = belowFits
          ? belowTop
          : fromRect.top - base.top - height - POPOVER_OFFSET;
        const minTop = editorRect.top - base.top + POPOVER_MARGIN;
        const maxTop = editorRect.bottom - base.top - height - POPOVER_MARGIN;
        const clampedTop = Math.max(minTop, Math.min(top, maxTop));

        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(clampedTop)}px`;
        return true;
      }

      private removePopover(): void {
        if (this.popover) {
          this.popover.remove();
          this.popover = null;
        }
      }

      private isPointerOnKeepAlive(): boolean {
        if (this.lastClientX < 0) return false;
        const el = document.elementFromPoint(this.lastClientX, this.lastClientY);
        if (this.popover && el && this.popover.contains(el)) return true;
        if (el && el.instanceOf(Element)) {
          return (
            el.closest(".cards4links-hover-url") === this.activeSpan &&
            this.activeSpan !== null
          );
        }
        return false;
      }

      private hide(): void {
        if (this.isPointerOnKeepAlive()) return;
        if (!this.graceElapsed()) {
          this.deferHide();
          return;
        }
        this.hardHide();
      }

      private hardHide(): void {
        this.clearTimers();
        this.removePopover();
        this.payload = null;
        this.activeSpan = null;
        this.shownAt = -1;
      }

      private graceElapsed(): boolean {
        return (
          this.shownAt < 0 ||
          Date.now() >= this.shownAt + getTooltipDurationMs()
        );
      }

      private deferHide(): void {
        if (this.hideTimer >= 0) return;
        const delay = Math.max(
          0,
          this.shownAt + getTooltipDurationMs() - Date.now()
        );
        this.hideTimer = window.setTimeout(() => {
          this.hideTimer = -1;
          this.hide();
        }, delay);
      }
    },
    {
      decorations: (value) => value.decorations,
      eventHandlers: {
        mousemove(event) {
          this.handleMousemove(event);
        },
        mouseleave() {
          this.handleMouseleave();
        },
      },
    }
  );
}