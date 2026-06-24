import { App, MarkdownView, Notice, parseYaml } from "obsidian";
import { LinkMetadata, ContentType } from "./metadata-parser";
import type { ThumbnailPosition, CardView } from "./settings";
import { EditorExtensions } from "./editor-extensions";

function createSvgIcon(viewBox: string, size: number, ...elements: Array<[string, Record<string, string>]>): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  for (const [tag, attrs] of elements) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    svg.appendChild(el);
  }
  return svg;
}

function detectContentType(host: string | undefined): ContentType {
  if (!host) return "article";
  const videoHosts = [
    "youtube.com", "youtu.be", "vimeo.com", "twitch.tv",
    "dailymotion.com", "kick.com", "facebook.com",
  ];
  return videoHosts.some((h) => host.includes(h)) ? "video" : "article";
}

class YamlParseError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "YamlParseError";
  }
}

class NoRequiredParamsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "NoRequiredParamsError";
  }
}

export class CardProcessor {
  private source: string = "";
  private sections: string[] = [];

  constructor(
    private app: App,
    private thumbnailPosition: ThumbnailPosition = "right",
    private defaultView: CardView = "card"
  ) {}

  run(source: string, el: HTMLElement): void {
    this.source = source;
    const raw = source.split(/\n-{3,}\n/).map(s => s.trim());
    this.sections = raw.length > 1 ? raw : [source];

    if (this.sections.length <= 1) {
      try {
        const data = this.parseYaml(source);
        el.appendChild(this.renderCard(data, source, 0));
      } catch (error) {
        el.appendChild(this.renderError(error as Error));
      }
    } else {
      const group = el.createDiv({ cls: "cards4links-group" });
      for (let i = 0; i < this.sections.length; i++) {
        try {
          const data = this.parseYaml(this.sections[i]);
          group.appendChild(this.renderCard(data, this.sections[i], i));
        } catch (error) {
          group.appendChild(this.renderError(error as Error));
        }
      }
    }
  }

  private parseYaml(source: string): LinkMetadata {
    let yaml: Partial<LinkMetadata>;
    let indent = 0;

    const normalized = source
      .split(/\r?\n|\r|\n/g)
      .map((line) =>
        line.replace(/^\t+/g, (tabs) => {
          if (indent === 0) indent = tabs.length;
          return " ".repeat(tabs.length);
        })
      )
      .join("\n");

    try {
      yaml = parseYaml(normalized) as Partial<LinkMetadata>;
    } catch (error) {
      console.log("Cards4Links YAML parse error:", error);
      throw new YamlParseError(
        "Failed to parse YAML. Check debug console for details."
      );
    }

    if (!yaml || !yaml.url || !yaml.title) {
      throw new NoRequiredParamsError(
        "Required params [url, title] not found."
      );
    }

    return {
      url: yaml.url,
      title: yaml.title,
      description: yaml.description,
      host: yaml.host,
      favicon: yaml.favicon,
      image: yaml.image,
      watched: yaml.watched === true,
      view: yaml.view ?? "card",
      contentType: detectContentType(yaml.host),
    };
  }

  private renderCard(data: LinkMetadata, source: string, cardIndex: number): HTMLElement {
    const view = data.view || "card";
    const needsUpgrade = !/^view:/m.test(source);

    const container = createDiv({
      cls: "cards4links-container",
      attr: {
        "data-thumbnail": this.thumbnailPosition,
        "data-view": view,
        "data-watched": data.watched ? "true" : "false",
      },
    });

    const card = container.createEl("a", {
      cls: "cards4links-card",
      attr: { href: data.url },
    });

    const main = card.createDiv({ cls: "cards4links-main" });

    const titleRow = main.createDiv({ cls: "cards4links-title-row" });
    titleRow.createSpan({
      cls: "cards4links-title-text",
      text: data.title,
    });

    // --- Top-left actions (upgrade, watch) ---
    const actionsLeft = container.createDiv({ cls: "cards4links-actions-left" });

    if (needsUpgrade) {
      const upgradeBtn = actionsLeft.createEl("button", {
        cls: "cards4links-upgrade-btn clickable-icon",
        attr: { "aria-label": "Add view field to card" },
      });
      upgradeBtn.appendChild(
        createSvgIcon("0 0 24 24", 14,
          ["path", { d: "M5 10l7-7 7 7", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
          ["path", { d: "M12 3v18", fill: "none", stroke: "currentColor", "stroke-width": "2" }]
        )
      );
      upgradeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        container.dataset.view = this.defaultView;
        const oldSource = this.source;
        const newSections = [...this.sections];
        newSections[cardIndex] = newSections[cardIndex] + `\nview: ${this.defaultView}`;
        const newSource = newSections.join("\n---\n");
        this.replaceBlock(oldSource, newSource);
        this.sections = newSections;
        this.source = newSource;
        upgradeBtn.remove();
      });
    }

    // --- Top-right actions (view toggle, watch) ---
    const actions = container.createDiv({ cls: "cards4links-actions" });

    const viewCycle: CardView[] = ["card", "compact", "minimal"];

    const viewBtn = actions.createEl("button", {
      cls: "cards4links-view-btn clickable-icon",
      attr: { "aria-label": `View: ${view}` },
    });
    viewBtn.appendChild(
      createSvgIcon("0 0 24 24", 14,
        ["rect", { x: "3", y: "3", width: "8", height: "8", rx: "1", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
        ["rect", { x: "13", y: "3", width: "8", height: "8", rx: "1", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
        ["rect", { x: "3", y: "13", width: "8", height: "8", rx: "1", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
        ["rect", { x: "13", y: "13", width: "8", height: "8", rx: "1", fill: "none", stroke: "currentColor", "stroke-width": "2" }]
      )
    );
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentView = (container.dataset.view as CardView) || "card";
      const next = viewCycle[(viewCycle.indexOf(currentView) + 1) % viewCycle.length];
      container.dataset.view = next;
      this.updateCardBlock(cardIndex, "view", next);
    });

    const label = data.contentType === "video" ? "Watched" : "Read";
    const watchToggleBtn = actions.createEl("button", {
      cls: "cards4links-watch-toggle clickable-icon",
      attr: {
        "aria-label": data.watched
          ? "Mark as Unread"
          : `Mark as ${label}`,
      },
    });
    const checkedSvg = createSvgIcon("0 0 24 24", 14,
      ["circle", { cx: "12", cy: "12", r: "10", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
      ["path", { d: "M8 12l3 3 5-5", fill: "none", stroke: "currentColor", "stroke-width": "2" }]
    );
    const uncheckedSvg = createSvgIcon("0 0 24 24", 14,
      ["circle", { cx: "12", cy: "12", r: "10", fill: "none", stroke: "currentColor", "stroke-width": "2" }]
    );
    watchToggleBtn.appendChild(data.watched ? checkedSvg.cloneNode(true) : uncheckedSvg.cloneNode(true));
    watchToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentlyWatched = container.dataset.watched === "true";
      const newWatched = !currentlyWatched;
      container.dataset.watched = newWatched ? "true" : "false";
      watchToggleBtn.empty();
      watchToggleBtn.appendChild(newWatched ? checkedSvg.cloneNode(true) : uncheckedSvg.cloneNode(true));
      watchToggleBtn.setAttr(
        "aria-label",
        newWatched ? "Mark as Unread" : `Mark as ${label}`
      );
      this.updateCardBlock(cardIndex, "watched", newWatched);
    });

    // --- Description ---
    if (data.description) {
      main.createDiv({
        cls: "cards4links-description",
        text: data.description,
      });
    }

    const hostRow = main.createDiv({ cls: "cards4links-host" });
    if (data.favicon) {
      hostRow.createEl("img", {
        cls: "cards4links-favicon",
        attr: { src: data.favicon },
      });
    }
    if (data.host) {
      hostRow.createSpan({ text: data.host });
    }

    if (data.image) {
      const img = card.createEl("img", {
        cls: "cards4links-thumbnail",
        attr: { src: data.image, draggable: "false" },
      });
      img.addEventListener("error", () => {
        img.classList.add("cards4links-thumbnail-hidden");
      });
    }

    const copyBtn = container.createEl("button", {
      cls: "cards4links-copy-url clickable-icon",
      attr: { "aria-label": `Copy URL\n${data.url}` },
    });
    copyBtn.appendChild(
      createSvgIcon("0 0 24 24", 16,
        ["path", { fill: "currentColor", d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" }]
      )
    );
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(data.url);
      new Notice("URL copied to clipboard");
    });

    return container;
  }

  private updateCardBlock(
    cardIndex: number,
    field: "watched" | "view",
    value: boolean | string
  ): void {
    const section = this.sections[cardIndex];
    const fieldRegex = new RegExp(`^${field}:.*$`, "m");
    const newSection = fieldRegex.test(section)
      ? section.replace(fieldRegex, `${field}: ${value}`)
      : section + `\n${field}: ${value}`;

    const newSections = [...this.sections];
    newSections[cardIndex] = newSection;
    const newSource = newSections.join("\n---\n");
    const oldSource = this.source;

    this.replaceBlock(oldSource, newSource);

    this.sections = newSections;
    this.source = newSource;
  }

  private replaceBlock(oldSource: string, newSource: string): void {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      console.log("Cards4Links: no active MarkdownView");
      new Notice("Cards4Links: cannot edit in Reading view");
      return;
    }
    const editor = markdownView.editor;
    if (!editor) {
      console.log("Cards4Links: no editor available");
      return;
    }

    const text = editor.getValue();
    const blockRegex = /```cardlink\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
      const blockContent = match[1];
      if (blockContent.replace(/\r\n/g, "\n").trimEnd() !== oldSource.replace(/\r\n/g, "\n").trimEnd()) continue;

      // Detect > prefix for callout blocks
      const lines = blockContent.split('\n');
      const hasPrefix = lines.some(l => l.trim() && l.startsWith('> '));

      const finalContent = hasPrefix
        ? newSource.split('\n').map(l => '> ' + l).join('\n')
        : newSource;

      const startPos = EditorExtensions.posFromIndex(text, match.index);
      const endPos = EditorExtensions.posFromIndex(
        text,
        match.index + match[0].length
      );

      try {
        editor.replaceRange(
          `\`\`\`cardlink\n${finalContent}\n\`\`\``,
          startPos,
          endPos
        );
      } catch (e) {
        console.log("Cards4Links: failed to update code block", e);
        new Notice("Cards4Links: error updating card state");
      }
      break;
    }
  }

  private renderError(error: Error): HTMLElement {
    const container = createDiv({ cls: "cards4links-error" });
    container.setText(`cardlink error: ${error.message}`);
    return container;
  }
}
