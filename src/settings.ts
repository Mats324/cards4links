import { App, PluginSettingTab, Setting } from "obsidian";
import Cards4Links from "./main";

export type ThumbnailPosition = "right" | "left" | "none";
export type CardView = "card" | "compact" | "minimal";

export function isThumbnailPosition(v: string): v is ThumbnailPosition {
  return v === "right" || v === "left" || v === "none";
}

export function isCardView(v: string): v is CardView {
  return v === "card" || v === "compact" || v === "minimal";
}

export interface Cards4LinksSettings {
  enhanceDefaultPaste: boolean;
  thumbnailPosition: ThumbnailPosition;
  showInMenuItem: boolean;
  enableWatched: boolean;
  defaultView: CardView;
}

export const DEFAULT_SETTINGS: Cards4LinksSettings = {
  enhanceDefaultPaste: false,
  thumbnailPosition: "right",
  showInMenuItem: true,
  enableWatched: false,
  defaultView: "card",
};

export class Cards4LinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: Cards4Links
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enhance default paste")
      .setDesc(
        "Automatically fetch metadata when pasting a URL with the default paste command"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enhanceDefaultPaste)
          .onChange(async (value) => {
            this.plugin.settings.enhanceDefaultPaste = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Thumbnail position")
      .setDesc("Where to show the thumbnail image in the card")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("right", "Right")
          .addOption("left", "Left")
          .addOption("none", "No thumbnail")
          .setValue(this.plugin.settings.thumbnailPosition)
          .onChange(async (value) => {
            if (!isThumbnailPosition(value)) return;
            this.plugin.settings.thumbnailPosition = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show commands in menu item")
      .setDesc("Add paste/enhance commands to the right-click context menu")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInMenuItem)
          .onChange(async (value) => {
            this.plugin.settings.showInMenuItem = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable watched/read checkbox")
      .setDesc(
        "Show a checkbox on cards to track watched (video) or read (article) status"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableWatched)
          .onChange(async (value) => {
            this.plugin.settings.enableWatched = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default card view")
      .setDesc("Default view style for newly created cards")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("card", "Card")
          .addOption("compact", "Compact")
          .addOption("minimal", "Minimal")
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            if (!isCardView(value)) return;
            this.plugin.settings.defaultView = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
