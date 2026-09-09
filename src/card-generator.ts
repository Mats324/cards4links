import { App, Editor, Notice, TFile, requestUrl } from "obsidian";
import { MetadataParser, LinkMetadata } from "./metadata-parser";
import { EditorExtensions } from "./editor-extensions";
import type { CardView, CacheLocation } from "./settings";
import { t } from "./i18n";
import {
  hashUrl,
  downloadImage,
  getCacheFolderPath,
  ensureFolder,
  addToManifest,
} from "./image-cache";

export class CardGenerator {
  constructor(
    private editor: Editor,
    private defaultView: CardView = "card",
    private cacheImages = false,
    private cacheFolder = "cards4links-cache",
    private cacheLocation: CacheLocation = "vault-absolute",
    private app?: App,
    private onCardsCreated?: (count: number) => void
  ) {}

  async convert(url: string): Promise<void> {
    const selectedText = this.editor.getSelection();
    const placeholderId = this.randomId();
    const placeholder = `[Fetching Data#${placeholderId}](${url})`;

    this.editor.replaceSelection(placeholder);
    new Notice(t("notice.fetchingMetadata"));

    const metadata = await this.fetchMetadata(url);
    if (metadata && this.cacheImages && metadata.image && this.app) {
      await this.cacheImage(metadata);
    }
    const text = this.editor.getValue();
    const start = text.indexOf(placeholder);

    if (start < 0) {
      console.log(
        `Could not find placeholder "${placeholder}" in editor, bailing out; url ${url}`
      );
      return;
    }

    const end = start + placeholder.length;
    const startPos = EditorExtensions.posFromIndex(text, start);
    const endPos = EditorExtensions.posFromIndex(text, end);

    if (!metadata) {
      new Notice(t("notice.fetchFailed"));
      this.editor.replaceRange(selectedText || url, startPos, endPos);
      return;
    }

    this.editor.replaceRange(this.generateCodeBlock(metadata), startPos, endPos);
    this.onCardsCreated?.(1);
  }

  async convertGroup(urls: string[]): Promise<void> {
    if (urls.length < 2) {
      new Notice(t("notice.selectTwoUrls"));
      return;
    }

    const selectedText = this.editor.getSelection();
    const placeholderId = this.randomId();
    const placeholder = `[Fetching Data#${placeholderId}](${urls.length} links)`;

    this.editor.replaceSelection(placeholder);
    new Notice(t("notice.fetchingMetadataGroup", { count: urls.length }));

    const results = await Promise.allSettled(
      urls.map((url) => this.fetchMetadata(url))
    );

    const metadataList: LinkMetadata[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        metadataList.push(r.value);
      }
    }

    if (metadataList.length === 0) {
      new Notice(t("notice.fetchFailedAll"));
      this.editor.replaceSelection(selectedText || urls.join("\n"));
      return;
    }

    if (this.cacheImages && this.app) {
      for (const md of metadataList) {
        if (md.image) {
          await this.cacheImage(md);
        }
      }
    }

    const text = this.editor.getValue();
    const start = text.indexOf(placeholder);

    if (start < 0) {
      console.log(
        `Cards4Links: could not find placeholder "${placeholder}" in editor`
      );
      return;
    }

    const end = start + placeholder.length;
    const startPos = EditorExtensions.posFromIndex(text, start);
    const endPos = EditorExtensions.posFromIndex(text, end);

    this.editor.replaceRange(
      this.generateGroupCodeBlock(metadataList),
      startPos,
      endPos
    );

    this.onCardsCreated?.(metadataList.length);

    new Notice(t("notice.createdCarousel", { count: metadataList.length }));
  }

  private generateCodeBlock(md: LinkMetadata): string {
    const lines = ["\n```cardlink"];
    lines.push(`url: ${md.url}`);
    lines.push(`title: "${md.title}"`);
    if (md.description) lines.push(`description: "${md.description}"`);
    if (md.host) lines.push(`host: ${md.host}`);
    if (md.favicon) lines.push(`favicon: ${md.favicon}`);
    if (md.image) lines.push(`image: ${md.image}`);
    if (md.imageLocal) lines.push(`imageLocal: ${md.imageLocal}`);
    lines.push(`watched: false`);
    lines.push(`view: ${this.defaultView}`);
    lines.push("```\n");
    return lines.join("\n");
  }

  private generateGroupCodeBlock(mdList: LinkMetadata[]): string {
    const sections = mdList.map((md) => {
      const sLines = [];
      sLines.push(`url: ${md.url}`);
      sLines.push(`title: "${md.title}"`);
      if (md.description) sLines.push(`description: "${md.description}"`);
      if (md.host) sLines.push(`host: ${md.host}`);
      if (md.favicon) sLines.push(`favicon: ${md.favicon}`);
      if (md.image) sLines.push(`image: ${md.image}`);
      if (md.imageLocal) sLines.push(`imageLocal: ${md.imageLocal}`);
      sLines.push(`watched: false`);
      sLines.push(`view: carousel`);
      return sLines.join("\n");
    });

    return "\n```cardlink\n" + sections.join("\n---\n") + "\n```\n";
  }

  private async fetchMetadata(
    url: string
  ): Promise<LinkMetadata | undefined> {
    try {
      const res = await requestUrl({ url });

      if (res.status !== 200) {
        console.log(`Cards4Links: bad response status ${res.status}`);
        return undefined;
      }

      const parser = new MetadataParser(url, res.text);
      return await parser.parse();
    } catch (e) {
      console.log("Cards4Links fetch error:", e);
      return undefined;
    }
  }

  private async cacheImage(metadata: LinkMetadata): Promise<void> {
    try {
      const activeFile = this.app!.workspace.getActiveFile();
      const folder = getCacheFolderPath(
        activeFile,
        this.cacheLocation,
        this.cacheFolder
      );
      await ensureFolder(this.app!, folder);

      const filename = await hashUrl(metadata.image!);
      const existing = this.app!.vault.getAbstractFileByPath(
        `${folder}/${filename}`
      );
      if (!existing) {
        const buffer = await downloadImage(metadata.image!);
        await this.app!.vault.createBinary(`${folder}/${filename}`, buffer);
      }

      const file = this.app!.vault.getAbstractFileByPath(
        `${folder}/${filename}`
      );

      await addToManifest(this.app!, folder, {
        filename,
        originalUrl: metadata.image!,
        cachedAt: new Date().toISOString(),
        size: file && file instanceof TFile ? file.stat.size : 0,
      });

      metadata.imageLocal = `${folder}/${filename}`;
    } catch (e) {
      console.log("Cards4Links: failed to cache image", e);
    }
  }

  private randomId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
