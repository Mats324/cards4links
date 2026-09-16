import type { Extension } from "@codemirror/state";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { extractUrlFromLink, lineUrlRegex, linkLineRegex } from "./utils";
import { t } from "./i18n";

export interface HoverConvertPayload {
  url: string;
  line: number;
  fromCh: number;
  toCh: number;
}

export function hoverEnhanceExtension(
  enabled: () => boolean,
  onConvert: (payload: HoverConvertPayload) => void
): Extension {
  return hoverTooltip((view: EditorView, pos: number) => {
    if (!enabled()) return null;

    const line = view.state.doc.lineAt(pos);
    const text = view.state.doc.sliceString(line.from, line.to);

    let url = "";
    let fromCh = 0;
    let toCh = 0;

    for (const match of text.matchAll(linkLineRegex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (pos >= line.from + start && pos <= line.from + end) {
        url = extractUrlFromLink(match[0]);
        fromCh = start;
        toCh = end;
        break;
      }
    }

    if (!url) {
      for (const match of text.matchAll(lineUrlRegex)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (pos >= line.from + start && pos <= line.from + end) {
          url = match[0];
          fromCh = start;
          toCh = end;
          break;
        }
      }
    }

    if (!url) return null;

    return {
      pos,
      above: true,
      create: () => {
        const dom = document.createElement("div");
        dom.addClass("cards4links-hover-tooltip");

        const button = dom.createEl("button", {
          cls: "cards4links-hover-convert",
          text: t("hover.convertButton"),
        });

        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.focus();
          onConvert({
            url,
            line: line.number - 1,
            fromCh,
            toCh,
          });
        });

        return { dom };
      },
    };
  });
}