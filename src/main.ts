import { Plugin, Editor, EditorPosition, MarkdownView, Menu, Notice } from "obsidian";
import {
  Cards4LinksSettings,
  Cards4LinksSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";
import { CardGenerator } from "./card-generator";
import { CardProcessor } from "./card-processor";
import { isUrl, isImage, isLinkedUrl, extractUrlFromLink } from "./utils";
import { EditorExtensions } from "./editor-extensions";

const WELCOME_DELAY_MS = 1500;

const CARD_MILESTONES: { threshold: number; message: string }[] = [
  {
    threshold: 1,
    message:
      "First card created! 🎉 Enable 'Enhance default paste' in settings to convert URLs automatically on paste.",
  },
  {
    threshold: 3,
    message:
      "3 cards created! Select 2+ URLs and press Mod+Shift+C to build a carousel.",
  },
  {
    threshold: 5,
    message:
      "5 cards created! 🎉 Thanks for using Cards4Links! https://github.com/Mats324/cards4links",
  },
  {
    threshold: 10,
    message:
      "10 cards created! Try a card theme (light/dark) in settings for a different look.",
  },
  {
    threshold: 25,
    message:
      "25 cards created! Enable the 'watched/read' checkbox to track videos and articles.",
  },
  {
    threshold: 50,
    message:
      "50 cards created! Explore other card views (compact, minimal) to save space.",
  },
  {
    threshold: 100,
    message:
      "100 cards created! Turn on 'Cache images locally' to keep card images available offline.",
  },
];

export default class Cards4Links extends Plugin {
  settings!: Cards4LinksSettings;

  async onload() {
    await this.loadSettings();

    if (!this.settings.welcomeShown) {
      window.setTimeout(() => {
        new Notice(
          "Cards4Links activated! Paste a URL into a note, or select a URL and press Mod+Shift+E."
        );
        this.settings.welcomeShown = true;
        void this.saveSettings();
      }, WELCOME_DELAY_MS);
    }

    this.registerMarkdownCodeBlockProcessor("cardlink", (source, el) => {
      const processor = new CardProcessor(
        this.app,
        this.settings.thumbnailPosition,
        this.settings.defaultView,
        this.settings.theme,
        this.settings.cacheImages,
        this.settings.cacheFolder,
        this.settings.cacheLocation,
        this.settings.cacheTTL
      );
      processor.run(source, el);
    });

    this.addCommand({
      id: "paste-and-enhance",
      name: "Paste URL and enhance to card link",
      editorCallback: async (editor: Editor) => {
        await this.manualPasteAndEnhance(editor);
      },
      hotkeys: [],
    });

    this.addCommand({
      id: "upgrade-old-cards",
      name: "Add view field to old cardlink cards",
      editorCallback: (editor: Editor) => {
        this.upgradeOldCards(editor);
      },
    });

    this.addCommand({
      id: "enhance-selected-url",
      name: "Enhance selected URL to card link",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        if (!navigator.onLine) return false;
        if (checking) return true;
        void this.enhanceSelected(editor);
        return;
      },
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
    });

    this.addCommand({
      id: "create-carousel",
      name: "Create carousel from selected URLs",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        if (!navigator.onLine) return false;
        if (checking) return true;
        void this.createCarousel(editor);
        return;
      },
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "c" }],
    });

    this.addCommand({
      id: "open-settings",
      name: "Open plugin settings",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "," }],
      callback: () => {
        const setting = (this.app as any).setting;
        setting.open();
        setting.openTabById("cards-for-links");
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", this.onPaste)
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", this.onEditorMenu)
    );

    this.addSettingTab(new Cards4LinksSettingTab(this.app, this));
  }

  private async enhanceSelected(editor: Editor): Promise<void> {
    const selected = (EditorExtensions.getSelectedText(editor) || "").trim();

    const generator = this.makeGenerator(editor);
    const urls: string[] = [];

    for (const line of selected.split(/[\n ]/)) {
      if (isUrl(line)) {
        urls.push(line);
      } else if (isLinkedUrl(line)) {
        const url = extractUrlFromLink(line);
        if (url) urls.push(url);
      }
    }

    if (urls.length === 0) return;
    if (urls.length === 1) {
      await generator.convert(urls[0]);
    } else {
      await generator.convertGroup(urls);
    }
  }

  private async createCarousel(editor: Editor): Promise<void> {
    const selected = (EditorExtensions.getSelectedText(editor) || "").trim();
    const generator = this.makeGenerator(editor);
    const urls: string[] = [];

    for (const line of selected.split(/[\n ]/)) {
      if (isUrl(line)) {
        urls.push(line);
      } else if (isLinkedUrl(line)) {
        const url = extractUrlFromLink(line);
        if (url) urls.push(url);
      }
    }

    if (urls.length < 2) {
      new Notice("Cards4Links: select 2+ URLs to create a carousel");
      return;
    }

    await generator.convertGroup(urls);
  }

  private async manualPasteAndEnhance(editor: Editor): Promise<void> {
    const clipboardText = await navigator.clipboard.readText();
    if (!clipboardText) return;

    if (!navigator.onLine) {
      editor.replaceSelection(clipboardText);
      return;
    }

    if (!isUrl(clipboardText) || isImage(clipboardText)) {
      editor.replaceSelection(clipboardText);
      return;
    }

    const generator = this.makeGenerator(editor);
    await generator.convert(clipboardText);
  }

  private onPaste = async (
    evt: ClipboardEvent,
    editor: Editor
  ): Promise<void> => {
    if (!this.settings.enhanceDefaultPaste) return;
    if (!navigator.onLine) return;
    if (!evt.clipboardData) return;
    if (evt.clipboardData.files.length > 0) return;

    const clipboardText = evt.clipboardData.getData("text/plain");
    if (!clipboardText) return;
    if (!isUrl(clipboardText) || isImage(clipboardText)) return;

    evt.stopPropagation();
    evt.preventDefault();

    const generator = this.makeGenerator(editor);
    await generator.convert(clipboardText);
  };

  private onEditorMenu = (menu: Menu): void => {
    if (!this.settings.showInMenuItem) return;

    menu.addItem((item) => {
      item
        .setTitle("Paste URL and enhance to card link")
        .setIcon("paste")
        .onClick(async () => {
          const editor = this.getEditor();
          if (!editor) return;
          await this.manualPasteAndEnhance(editor);
        });
    });

    if (!navigator.onLine) return;

    menu.addItem((item) => {
      item
        .setTitle("Enhance selected URL to card link")
        .setIcon("link")
        .onClick(() => {
          const editor = this.getEditor();
          if (!editor) return;
          void this.enhanceSelected(editor);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Create carousel from selected URLs")
        .setIcon("gallery-horizontal-end")
        .onClick(() => {
          const editor = this.getEditor();
          if (!editor) return;
          void this.createCarousel(editor);
        });
    });
  };

  private upgradeOldCards(editor: Editor): void {
    const text = editor.getValue();
    const blockRegex = /```cardlink\n([\s\S]*?)```/g;
    const replacements: {
      start: EditorPosition;
      end: EditorPosition;
      content: string;
    }[] = [];
    let match;

    while ((match = blockRegex.exec(text)) !== null) {
      const blockContent = match[1].replace(/\r/g, "");
      if (/^view:/m.test(blockContent)) continue;

      const newContent =
        blockContent +
        (blockContent.endsWith("\n") ? "" : "\n") +
        `view: ${this.settings.defaultView}`;

      const startPos = EditorExtensions.posFromIndex(text, match.index);
      const endPos = EditorExtensions.posFromIndex(
        text,
        match.index + match[0].length
      );

      replacements.push({
        start: startPos,
        end: endPos,
        content: `\`\`\`cardlink\n${newContent}\`\`\``,
      });
    }

    if (replacements.length === 0) {
      new Notice("Cards4Links: no old cards found");
      return;
    }

    replacements.reverse();
    for (const r of replacements) {
      editor.replaceRange(r.content, r.start, r.end);
    }

    new Notice(`Cards4Links: updated ${replacements.length} card(s)`);
  }

  private getEditor(): Editor | undefined {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.editor;
  }

  private makeGenerator(editor: Editor): CardGenerator {
    return new CardGenerator(
      editor,
      this.settings.defaultView,
      this.settings.cacheImages,
      this.settings.cacheFolder,
      this.settings.cacheLocation,
      this.app,
      (count: number) => this.onCardsCreated(count)
    );
  }

  private async loadSettings() {
    const data = await this.loadData() as Partial<Cards4LinksSettings>;
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      data
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private onCardsCreated(count: number): void {
    this.settings.cardsCreated += count;

    const newTotal = this.settings.cardsCreated;
    for (const milestone of CARD_MILESTONES) {
      if (
        newTotal >= milestone.threshold &&
        !this.settings.milestonesShown.includes(milestone.threshold)
      ) {
        this.settings.milestonesShown.push(milestone.threshold);
        new Notice(milestone.message);
      }
    }

    void this.saveSettings();
  }
}
