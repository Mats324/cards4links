import { Editor, Notice, requestUrl } from "obsidian";
import { MetadataParser, LinkMetadata } from "./metadata-parser";
import { EditorExtensions } from "./editor-extensions";
import type { CardView } from "./settings";

export class CardGenerator {
  constructor(private editor: Editor, private defaultView: CardView = "card") {}

  async convert(url: string): Promise<void> {
    const selectedText = this.editor.getSelection();
    const placeholderId = this.randomId();
    const placeholder = `[Fetching Data#${placeholderId}](${url})`;

    this.editor.replaceSelection(placeholder);
    new Notice("Cards4Links: fetching metadata...");

    const metadata = await this.fetchMetadata(url);
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
      new Notice("Cards4Links: couldn't fetch link metadata");
      this.editor.replaceRange(selectedText || url, startPos, endPos);
      return;
    }

    this.editor.replaceRange(this.generateCodeBlock(metadata), startPos, endPos);
  }

  private generateCodeBlock(md: LinkMetadata): string {
    const lines = ["\n```cardlink"];
    lines.push(`url: ${md.url}`);
    lines.push(`title: "${md.title}"`);
    if (md.description) lines.push(`description: "${md.description}"`);
    if (md.host) lines.push(`host: ${md.host}`);
    if (md.favicon) lines.push(`favicon: ${md.favicon}`);
    if (md.image) lines.push(`image: ${md.image}`);
    lines.push(`watched: false`);
    lines.push(`view: ${this.defaultView}`);
    lines.push("```\n");
    return lines.join("\n");
  }

  private async fetchMetadata(
    url: string
  ): Promise<LinkMetadata | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await requestUrl({ url });
      clearTimeout(timeout);

      if (res.status !== 200) {
        console.log(`Cards4Links: bad response status ${res.status}`);
        return undefined;
      }

      const parser = new MetadataParser(url, res.text);
      return await parser.parse();
    } catch (e) {
      clearTimeout(timeout);
      console.log("Cards4Links fetch error:", e);
      return undefined;
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
