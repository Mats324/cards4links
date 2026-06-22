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

export default class Cards4Links extends Plugin {
  settings!: Cards4LinksSettings;

  async onload() {
    await this.loadSettings();

    this.registerMarkdownCodeBlockProcessor("cardlink", (source, el) => {
      const processor = new CardProcessor(
        this.app,
        this.settings.thumbnailPosition,
        this.settings.enableWatched,
        this.settings.defaultView
      );
      processor.run(source, el);
    });

    this.addCommand({
      id: "paste-and-enhance",
      name: "Paste URL and enhance to card link",
      editorCallback: (editor: Editor) => {
        this.manualPasteAndEnhance(editor);
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
        this.enhanceSelected(editor);
        return;
      },
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", this.onPaste)
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", this.onEditorMenu)
    );

    this.addSettingTab(new Cards4LinksSettingTab(this.app, this));
  }

  private enhanceSelected(editor: Editor): void {
    const selected = (EditorExtensions.getSelectedText(editor) || "").trim();

    const generator = new CardGenerator(editor, this.settings.defaultView);

    for (const line of selected.split(/[\n ]/)) {
      if (isUrl(line)) {
        generator.convert(line);
      } else if (isLinkedUrl(line)) {
        const url = extractUrlFromLink(line);
        if (url) generator.convert(url);
      }
    }
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

    const generator = new CardGenerator(editor, this.settings.defaultView);
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

    const generator = new CardGenerator(editor, this.settings.defaultView);
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
          this.enhanceSelected(editor);
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

  private async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
