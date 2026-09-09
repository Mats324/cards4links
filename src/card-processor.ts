import { App, MarkdownView, Modal, Notice, Setting, TFile, parseYaml } from "obsidian";
import { LinkMetadata, ContentType } from "./metadata-parser";
import type { ThumbnailPosition, CardView, CardTheme, CacheLocation } from "./settings";
import { EditorExtensions } from "./editor-extensions";
import { t } from "./i18n";
import {
  resolveResourceUrl,
  getManifest,
  isExpired,
  getCacheFolderPath,
  ensureFolder,
  downloadImage,
  addToManifest,
} from "./image-cache";

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
    private defaultView: CardView = "card",
    private theme: CardTheme = "default",
    private cacheImages = false,
    private cacheFolder = "cards4links-cache",
    private cacheLocation: CacheLocation = "vault-absolute",
    private cacheTTL = 30
  ) {}

  run(source: string, el: HTMLElement): void {
    this.source = source;
    const raw = source.split(/\n-{3,}\n/).map(s => s.trim());
    this.sections = raw.length > 1 ? raw : [source];

    if (this.sections.length <= 1) {
      try {
        const data = this.parseYaml(source);
        this.renderCard(el, data, source, 0, false);
      } catch (error) {
        el.appendChild(this.renderError(error as Error));
      }
    } else {
      const carousel = el.createDiv({
        cls: "cards4links-carousel",
        attr: {
          role: "region",
          "aria-label": t("aria.carousel"),
          "aria-roledescription": t("aria.carouselRoledescription"),
        },
      });

      const viewport = carousel.createDiv({
        cls: "cards4links-carousel-viewport",
        attr: { "aria-live": "off" },
      });

      const track = viewport.createDiv({ cls: "cards4links-carousel-track" });

      for (let i = 0; i < this.sections.length; i++) {
        const slide = track.createDiv({
          cls: "cards4links-carousel-slide",
          attr: {
            role: "group",
            "aria-roledescription": t("aria.slideRoledescription"),
            "aria-label": t("aria.slideOf", {
              current: i + 1,
              total: this.sections.length,
            }),
          },
        });
        try {
          const data = this.parseYaml(this.sections[i]);
          this.renderCard(slide, data, this.sections[i], i, true);
        } catch (error) {
          slide.appendChild(this.renderError(error as Error));
        }
      }

      const dotsContainer = carousel.createDiv({
        cls: "cards4links-carousel-dots",
        attr: { role: "tablist", "aria-label": t("aria.slideNavigation") },
      });

      for (let i = 0; i < this.sections.length; i++) {
        const dot = dotsContainer.createEl("button", {
          cls: "cards4links-carousel-dot",
          attr: {
            role: "tab",
            "aria-selected": i === 0 ? "true" : "false",
            "aria-label": t("aria.goToSlide", { index: i + 1 }),
            "data-index": String(i),
          },
        });
        if (i === 0) dot.classList.add("cards4links-carousel-dot-active");
      }

      const prevBtn = carousel.createEl("button", {
        cls: "cards4links-carousel-prev",
        attr: {
          "aria-label": t("aria.previousSlide"),
          disabled: "",
        },
      });
      prevBtn.appendChild(
        createSvgIcon("0 0 24 24", 18,
          ["path", { d: "M15 18l-6-6 6-6", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }]
        )
      );

      const nextBtn = carousel.createEl("button", {
        cls: "cards4links-carousel-next",
        attr: { "aria-label": t("aria.nextSlide") },
      });
      nextBtn.appendChild(
        createSvgIcon("0 0 24 24", 18,
          ["path", { d: "M9 6l6 6-6 6", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }]
        )
      );

      this.setupCarouselNav(viewport, dotsContainer, prevBtn, nextBtn);
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
      throw new YamlParseError(t("error.yamlParse"));
    }

    if (!yaml || !yaml.url || !yaml.title) {
      throw new NoRequiredParamsError(t("error.requiredParams"));
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

  private renderCard(
    parentEl: HTMLElement,
    data: LinkMetadata,
    sectionSource: string,
    cardIndex: number,
    isGroup: boolean
  ): void {
    const view = isGroup ? "carousel" : (data.view || "card");
    const needsUpgrade = !/^view:/m.test(sectionSource);

    // Actions bar
    const actionsBar = createDiv({ cls: "cards4links-actions-bar" });
    if (!isGroup) {
      actionsBar.classList.add("cards4links-actions-bar-float");
    }

    if (needsUpgrade) {
      const upgradeBtn = actionsBar.createEl("button", {
        cls: "cards4links-upgrade-btn clickable-icon",
        attr: { "aria-label": t("aria.addViewField") },
      });
      upgradeBtn.appendChild(
        createSvgIcon("0 0 24 24", 14,
          ["path", { d: "M5 10l7-7 7 7", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
          ["path", { d: "M12 3v18", fill: "none", stroke: "currentColor", "stroke-width": "2" }]
        )
      );
      upgradeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        container.dataset.view = isGroup ? "carousel" : this.defaultView;
        const oldSource = this.source;
        const newSections = [...this.sections];
        newSections[cardIndex] = newSections[cardIndex] + `\nview: ${isGroup ? "carousel" : this.defaultView}`;
        const newSource = newSections.join("\n---\n");
        this.replaceBlock(oldSource, newSource);
        this.sections = newSections;
        this.source = newSource;
        upgradeBtn.remove();
      });
    }

    if (!isGroup) {
      const viewCycle: CardView[] = ["card", "compact", "minimal"];

      const viewBtn = actionsBar.createEl("button", {
        cls: "cards4links-view-btn clickable-icon",
        attr: {
          "aria-label": t("aria.view", {
            view: this.localizeView(view),
          }),
        },
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
    }

    const label = data.contentType === "video" ? t("label.watched") : t("label.read");
    const watchToggleBtn = actionsBar.createEl("button", {
      cls: "cards4links-watch-toggle clickable-icon",
      attr: {
        "aria-label": data.watched
          ? t("aria.markUnread")
          : t("aria.markAs", { label }),
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
        newWatched ? t("aria.markUnread") : t("aria.markAs", { label })
      );
      this.updateCardBlock(cardIndex, "watched", newWatched);
    });

    // Container
    const container = createDiv({
      cls: "cards4links-container",
      attr: {
        "data-thumbnail": this.thumbnailPosition,
        "data-view": view,
        "data-watched": data.watched ? "true" : "false",
        "data-theme": this.theme,
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

    // --- Description ---
    if (data.description) {
      main.createDiv({
        cls: "cards4links-description",
        text: data.description,
      });
    } else {
      this.createDescriptionPlaceholder(main, cardIndex);
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
      this.renderImage(card, data, cardIndex);
    } else {
      this.createImagePlaceholder(card, cardIndex);
    }

    const copyBtn = container.createEl("button", {
      cls: "cards4links-copy-url clickable-icon",
      attr: { "aria-label": t("aria.copyUrl", { url: data.url }) },
    });
    copyBtn.appendChild(
      createSvgIcon("0 0 24 24", 16,
        ["path", { fill: "currentColor", d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" }]
      )
    );
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(data.url);
      new Notice(t("notice.urlCopied"));
    });

    // Append to DOM
    if (isGroup) {
      const wrapper = createDiv({ cls: "cards4links-card-wrapper" });
      wrapper.appendChild(actionsBar);
      wrapper.appendChild(container);
      parentEl.appendChild(wrapper);
    } else {
      parentEl.appendChild(actionsBar);
      parentEl.appendChild(container);
    }
  }

  private renderImage(card: HTMLElement, data: LinkMetadata, cardIndex: number): void {
    const tryLocal = data.imageLocal && this.cacheImages;
    const doRender = (src: string) => {
      const img = card.createEl("img", {
        cls: "cards4links-thumbnail",
        attr: { src, draggable: "false" },
      });
      img.addEventListener("error", () => {
        if (tryLocal && data.image) {
          img.remove();
          doRender(data.image);
          return;
        }
        img.remove();
        this.createImagePlaceholder(card, cardIndex, data.image);
      });
    };

    if (tryLocal) {
      void resolveResourceUrl(this.app, data.imageLocal!).then((url) => {
        if (url) {
          doRender(url);
          void this.checkTtl(data);
        } else if (data.image) {
          doRender(data.image);
        } else {
          this.createImagePlaceholder(card, cardIndex);
        }
      });
    } else if (data.image) {
      doRender(data.image);
    }
  }

  private async checkTtl(data: LinkMetadata): Promise<void> {
    if (!data.imageLocal || this.cacheTTL <= 0 || !data.image) return;
    const folder = getCacheFolderPath(
      this.app.workspace.getActiveFile(),
      this.cacheLocation,
      this.cacheFolder
    );
    const manifest = await getManifest(this.app, folder);
    const pathParts = data.imageLocal.split("/");
    const filename = pathParts[pathParts.length - 1];
    const entry = manifest.files.find((f) => f.filename === filename);
    if (!entry) return;
    if (!isExpired(entry, this.cacheTTL)) return;

    try {
      const buffer = await downloadImage(data.image);
      const file = this.app.vault.getAbstractFileByPath(data.imageLocal);
      if (file instanceof TFile) {
        await this.app.vault.modifyBinary(file, buffer);
      } else {
        await ensureFolder(this.app, folder);
        await this.app.vault.createBinary(data.imageLocal, buffer);
      }
      const tf = this.app.vault.getAbstractFileByPath(data.imageLocal);
      await addToManifest(this.app, folder, {
        filename,
        originalUrl: data.image,
        cachedAt: new Date().toISOString(),
        size: tf instanceof TFile ? tf.stat.size : 0,
      });
    } catch (e) {
      console.log("Cards4Links: TTL refresh failed", e);
    }
  }

  private createImagePlaceholder(
    cardEl: HTMLElement,
    cardIndex: number,
    currentImageUrl?: string
  ): void {
    const placeholder = cardEl.createDiv({ cls: "cards4links-img-placeholder" });

    const svgContainer = placeholder.createDiv({ cls: "cards4links-img-placeholder-icon" });
    svgContainer.appendChild(
      createSvgIcon("0 0 24 24", 22,
        ["rect", { x: "2", y: "2", width: "20", height: "20", rx: "2", fill: "none", stroke: "currentColor", "stroke-width": "2" }],
        ["path", { d: "M21 15l-5-5L5 21", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }],
        ["path", { d: "M17 6h6M20 3v6", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }]
      )
    );

    placeholder.createSpan({
      cls: "cards4links-img-placeholder-text",
      text: t("placeholder.setImage"),
    });

    placeholder.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modal = new ImagePickerModal(
        this.app,
        currentImageUrl,
        (newUrl: string) => {
          this.updateCardBlock(cardIndex, "image", newUrl);
        }
      );
      modal.open();
    });
  }

  private createDescriptionPlaceholder(
    main: HTMLElement,
    cardIndex: number
  ): void {
    const placeholder = main.createDiv({ cls: "cards4links-description-placeholder" });

    placeholder.appendChild(
      createSvgIcon("0 0 24 24", 12,
        ["path", { d: "M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }]
      )
    );

    placeholder.createSpan({
      text: t("placeholder.addDescription"),
    });

    placeholder.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modal = new DescriptionInputModal(
        this.app,
        (value: string) => {
          this.updateCardBlock(cardIndex, "description", value);
        }
      );
      modal.open();
    });
  }

  private updateCardBlock(
    cardIndex: number,
    field: "watched" | "view" | "image" | "description",
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
      new Notice(t("notice.cannotEditReading"));
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
        new Notice(t("notice.errorUpdatingCard"));
      }
      break;
    }
  }

  private renderError(error: Error): HTMLElement {
    const container = createDiv({ cls: "cards4links-error" });
    container.setText(t("error.cardlink", { message: error.message }));
    return container;
  }

  private localizeView(view: string): string {
    switch (view) {
      case "compact":
        return t("settings.view.compact");
      case "minimal":
        return t("settings.view.minimal");
      case "carousel":
        return t("settings.view.carousel");
      default:
        return t("settings.view.card");
    }
  }

  private setupCarouselNav(
    viewport: HTMLElement,
    dotsContainer: HTMLElement,
    prevBtn: HTMLElement,
    nextBtn: HTMLElement
  ): void {
    const slides = Array.from(viewport.querySelectorAll<HTMLElement>(".cards4links-carousel-slide"));
    const dots = Array.from(dotsContainer.querySelectorAll<HTMLElement>(".cards4links-carousel-dot"));
    if (slides.length === 0) return;

    const getSlideWidth = (): number => {
      const slide = slides[0];
      if (!slide) return 0;
      const style = getComputedStyle(viewport.parentElement!);
      const gap = parseFloat(style.getPropertyValue("gap")) || 16;
      return slide.offsetWidth + gap;
    };

    const updateNav = (): void => {
      const scrollLeft = viewport.scrollLeft;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      const atStart = scrollLeft <= 1;
      const atEnd = scrollLeft >= maxScroll - 1;

      prevBtn.toggleAttribute("disabled", atStart);
      nextBtn.toggleAttribute("disabled", atEnd);

      let closestIdx = 0;
      let closestDist = Infinity;
      slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft - scrollLeft);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });

      dots.forEach((dot, i) => {
        const isActive = i === closestIdx;
        dot.classList.toggle("cards4links-carousel-dot-active", isActive);
        dot.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    };

    let scrollTimer = 0;
    viewport.addEventListener("scroll", () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(updateNav, 60);
    });

    prevBtn.addEventListener("click", () => {
      void viewport.scrollBy({ left: -getSlideWidth(), behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      void viewport.scrollBy({ left: getSlideWidth(), behavior: "smooth" });
    });

    dotsContainer.addEventListener("click", (e) => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>(".cards4links-carousel-dot");
      if (!dot) return;
      const idx = parseInt(dot.dataset.index ?? "0", 10);
      const target = slides[idx];
      if (target) {
        viewport.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
      }
    });

    viewport.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void viewport.scrollBy({ left: -getSlideWidth(), behavior: "smooth" });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void viewport.scrollBy({ left: getSlideWidth(), behavior: "smooth" });
      }
    });

    requestAnimationFrame(() => updateNav());
  }
}

class ImagePickerModal extends Modal {
  private currentUrl: string;
  private onSubmit: (url: string) => void;

  constructor(
    app: App,
    currentUrl: string | undefined,
    onSubmit: (url: string) => void
  ) {
    super(app);
    this.currentUrl = currentUrl ?? "";
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("cards4links-modal");
    contentEl.createEl("h2", { text: t("modal.setImageTitle") });

    let imageUrl = this.currentUrl;
    let textInput: HTMLInputElement;

    new Setting(contentEl)
      .setName(t("modal.imageUrl"))
      .setDesc(t("modal.imageUrlDesc"))
      .addText((text) => {
        text.setValue(imageUrl);
        text.onChange((value) => {
          imageUrl = value;
        });
        text.inputEl.focus();
        text.inputEl.select();
        textInput = text.inputEl;
      })
      .addExtraButton((btn) => {
        btn.setIcon("clipboard");
        btn.setTooltip(t("modal.pasteFromClipboard"));
        btn.onClick(async () => {
          try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText) {
              imageUrl = clipboardText;
              textInput.value = clipboardText;
            }
          } catch {
            // ignore
          }
        });
      });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText(t("ui.save"));
        btn.setCta();
        btn.onClick(() => {
          const url = imageUrl.trim();
          if (!url) return;

          const img = new Image();
          img.onload = () => {
            this.onSubmit(url);
            this.close();
          };
          img.onerror = () => {
            new Notice(t("notice.imageLoadFailed"));
          };
          img.src = url;
        });
      })
      .addButton((btn) => {
        btn.setButtonText(t("ui.cancel"));
        btn.onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class DescriptionInputModal extends Modal {
  private onSubmit: (desc: string) => void;

  constructor(
    app: App,
    onSubmit: (desc: string) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("cards4links-modal");
    contentEl.createEl("h2", { text: t("modal.setDescriptionTitle") });

    let description = "";

    new Setting(contentEl)
      .setName(t("modal.description"))
      .addTextArea((text) => {
        text.setValue(description);
        text.onChange((value) => {
          description = value;
        });
        text.inputEl.rows = 4;
        text.inputEl.focus();
      });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText(t("ui.save"));
        btn.setCta();
        btn.onClick(() => {
          this.onSubmit(description);
          this.close();
        });
      })
      .addButton((btn) => {
        btn.setButtonText(t("ui.cancel"));
        btn.onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
