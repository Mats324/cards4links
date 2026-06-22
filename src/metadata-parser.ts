export type ContentType = "video" | "article";

export interface LinkMetadata {
  url: string;
  title: string;
  description?: string;
  host?: string;
  favicon?: string;
  image?: string;
  watched?: boolean;
  view?: "card" | "compact" | "minimal";
  contentType?: ContentType;
}

export class MetadataParser {
  url: string;
  htmlDoc: Document;

  constructor(url: string, htmlText: string) {
    this.url = url;
    const parser = new DOMParser();
    this.htmlDoc = parser.parseFromString(htmlText, "text/html");
  }

  async parse(): Promise<LinkMetadata | undefined> {
    const title = this.getTitle()
      ?.replace(/\r\n|\n|\r/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .trim();
    if (!title) return;

    const description = this.getDescription()
      ?.replace(/\r\n|\n|\r/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .trim();
    const { hostname } = new URL(this.url);
    const favicon = await this.getFavicon();
    const image = await this.getImage();

    return {
      url: this.url,
      title,
      description,
      host: hostname,
      favicon,
      image,
    };
  }

  private getTitle(): string | undefined {
    const ogTitle = this.htmlDoc
      .querySelector("meta[property='og:title']")
      ?.getAttr("content");
    if (ogTitle) return ogTitle;
    return this.htmlDoc.querySelector("title")?.textContent ?? undefined;
  }

  private getDescription(): string | undefined {
    const ogDesc = this.htmlDoc
      .querySelector("meta[property='og:description']")
      ?.getAttr("content");
    if (ogDesc) return ogDesc;
    return (
      this.htmlDoc
        .querySelector("meta[name='description']")
        ?.getAttr("content") ?? undefined
    );
  }

  private async getFavicon(): Promise<string | undefined> {
    const href = this.htmlDoc
      .querySelector("link[rel='icon']")
      ?.getAttr("href");
    if (href) return this.resolveUrlDual(href);
    return undefined;
  }

  private async getImage(): Promise<string | undefined> {
    const content = this.htmlDoc
      .querySelector("meta[property='og:image']")
      ?.getAttr("content");
    if (content) return this.resolveUrlDual(content);
    return undefined;
  }

  private resolveUrl(imageUrl: string): string {
    if (imageUrl.startsWith("//")) {
      return `https:${imageUrl}`;
    }
    if (imageUrl.startsWith("/")) {
      const { hostname } = new URL(this.url);
      return `https://${hostname}${imageUrl}`;
    }
    return imageUrl;
  }

  private resolveUrlDual(url: string): Promise<string> {
    if (!url.startsWith("//")) return Promise.resolve(this.resolveUrl(url));

    const httpsUrl = `https:${url}`;
    const httpUrl = `http:${url}`;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(httpsUrl);
      img.onerror = () => {
        const img2 = new Image();
        img2.onload = () => resolve(httpUrl);
        img2.onerror = () => resolve(httpsUrl);
        img2.src = httpUrl;
      };
      img.src = httpsUrl;
    });
  }
}
