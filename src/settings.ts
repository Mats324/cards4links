import { App, PluginSettingTab, type SettingDefinitionItem, type SettingDefinitionRender } from "obsidian";
import Cards4Links from "./main";
import { CacheCleanupModal } from "./cache-cleanup-modal";
import { ConfirmModal } from "./confirm-modal";
import { LanguageSetting, t } from "./i18n";

export type ThumbnailPosition = "right" | "left" | "none";
export type CardView = "card" | "compact" | "minimal" | "carousel";
export type CardTheme = "default" | "light" | "dark";
export type CacheLocation = "vault-absolute" | "note-relative";

export function isThumbnailPosition(v: string): v is ThumbnailPosition {
  return v === "right" || v === "left" || v === "none";
}

export function isCardView(v: string): v is CardView {
  return v === "card" || v === "compact" || v === "minimal" || v === "carousel";
}

export function isCardTheme(v: string): v is CardTheme {
  return v === "default" || v === "light" || v === "dark";
}

export function isCacheLocation(v: string): v is CacheLocation {
  return v === "vault-absolute" || v === "note-relative";
}

export interface Cards4LinksSettings {
  language: LanguageSetting;
  enhanceDefaultPaste: boolean;
  hoverEnhance: boolean;
  hoverTooltipDurationMs: number;
  thumbnailPosition: ThumbnailPosition;
  showInMenuItem: boolean;
  enableWatched: boolean;
  defaultView: CardView;
  theme: CardTheme;
  cacheImages: boolean;
  cacheFolder: string;
  cacheLocation: CacheLocation;
  cacheTTL: number;
  cardsCreated: number;
  globalCardsCreated: number;
  welcomeShown: boolean;
  milestonesShown: number[];
  enableWatchedMigrated: boolean;
}

export const DEFAULT_SETTINGS: Cards4LinksSettings = {
  language: "auto",
  enhanceDefaultPaste: false,
  hoverEnhance: true,
  hoverTooltipDurationMs: 1500,
  thumbnailPosition: "right",
  showInMenuItem: true,
  enableWatched: true,
  defaultView: "card",
  theme: "default",
  cacheImages: false,
  cacheFolder: "cards4links-cache",
  cacheLocation: "vault-absolute",
  cacheTTL: 30,
  cardsCreated: 0,
  globalCardsCreated: 0,
  welcomeShown: false,
  milestonesShown: [],
  enableWatchedMigrated: false,
};

export class Cards4LinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: Cards4Links
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: t("settings.section.plugin"),
        items: [
          {
            name: t("settings.language"),
            desc: t("settings.languageDesc"),
            control: {
              key: "language",
              type: "dropdown",
              options: {
                auto: `🌐 ${t("settings.language.auto")}`,
                en: `🇬🇧 ${t("settings.language.en")}`,
                it: `🇮🇹 ${t("settings.language.it")}`,
              },
            },
          },
          this.counterSetting(),
        ],
      },
      {
        type: "group",
        heading: t("settings.section.integration"),
        items: [
          {
            name: t("settings.enhancePaste"),
            desc: t("settings.enhancePasteDesc"),
            control: { key: "enhanceDefaultPaste", type: "toggle" },
          },
          {
            name: t("settings.showInMenu"),
            desc: t("settings.showInMenuDesc"),
            control: { key: "showInMenuItem", type: "toggle" },
          },
          {
            name: t("settings.hoverEnhance"),
            desc: t("settings.hoverEnhanceDesc"),
            control: { key: "hoverEnhance", type: "toggle" },
          },
          {
            name: t("settings.hoverDuration"),
            desc: t("settings.hoverDurationDesc"),
            visible: () => this.plugin.settings.hoverEnhance,
            control: {
              key: "hoverTooltipDurationMs",
              type: "dropdown",
              options: {
                "0": t("settings.hoverDuration.0"),
                "500": t("settings.hoverDuration.500"),
                "1000": t("settings.hoverDuration.1000"),
                "1500": t("settings.hoverDuration.1500"),
                "2000": t("settings.hoverDuration.2000"),
                "3000": t("settings.hoverDuration.3000"),
                "5000": t("settings.hoverDuration.5000"),
              },
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("settings.section.style"),
        items: [
          {
            name: t("settings.defaultView"),
            desc: t("settings.defaultViewDesc"),
            control: {
              key: "defaultView",
              type: "dropdown",
              options: {
                card: t("settings.view.card"),
                compact: t("settings.view.compact"),
                minimal: t("settings.view.minimal"),
              },
            },
          },
          {
            name: t("settings.theme"),
            desc: t("settings.themeDesc"),
            control: {
              key: "theme",
              type: "dropdown",
              options: {
                default: t("settings.theme.default"),
                light: t("settings.theme.light"),
                dark: t("settings.theme.dark"),
              },
            },
          },
          {
            name: t("settings.thumbnailPosition"),
            desc: t("settings.thumbnailPositionDesc"),
            control: {
              key: "thumbnailPosition",
              type: "dropdown",
              options: {
                right: t("settings.thumbnail.right"),
                left: t("settings.thumbnail.left"),
                none: t("settings.thumbnail.none"),
              },
            },
          },
          {
            name: t("settings.enableWatched"),
            desc: t("settings.enableWatchedDesc"),
            control: { key: "enableWatched", type: "toggle" },
          },
        ],
      },
      {
        type: "group",
        heading: t("settings.section.cache"),
        items: [
          {
            name: t("settings.cacheImages"),
            desc: t("settings.cacheImagesDesc"),
            control: { key: "cacheImages", type: "toggle" },
          },
          {
            name: t("settings.cacheStorage"),
            desc: t("settings.cacheStorageDesc"),
            visible: () => this.plugin.settings.cacheImages,
            control: {
              key: "cacheLocation",
              type: "dropdown",
              options: {
                "vault-absolute": t("settings.cacheLocation.vault"),
                "note-relative": t("settings.cacheLocation.note"),
              },
            },
          },
          {
            name: t("settings.cacheFolder"),
            desc: t("settings.cacheFolderDesc"),
            visible: () =>
              this.plugin.settings.cacheImages &&
              this.plugin.settings.cacheLocation === "vault-absolute",
            control: { key: "cacheFolder", type: "text" },
          },
          {
            name: t("settings.cacheTtl"),
            desc: t("settings.cacheTtlDesc"),
            visible: () => this.plugin.settings.cacheImages,
            control: {
              key: "cacheTTL",
              type: "dropdown",
              options: {
                "7": t("settings.ttl.7"),
                "30": t("settings.ttl.30"),
                "90": t("settings.ttl.90"),
                "180": t("settings.ttl.180"),
                "0": t("settings.ttl.0"),
              },
            },
          },
          this.manageCacheSetting(),
        ],
      },
    ];
  }

  private counterSetting(): SettingDefinitionRender {
    return {
      name: t("settings.cardsCreated"),
      render: (setting) => {
        setting
          .setName(t("settings.cardsCreated"))
          .setDesc(
            t("settings.cardsCreatedDesc", {
              count: this.plugin.settings.cardsCreated,
            })
          );
        setting.infoEl.createDiv({
          cls: "setting-item-description",
          text: t("settings.globalCardsCreated", {
            count: this.plugin.settings.globalCardsCreated,
          }),
        });
        setting.addButton((btn) =>
          btn
            .setButtonText(t("settings.resetCounter"))
            .setDestructive()
            .onClick(() => {
              new ConfirmModal(
                this.app,
                t("settings.resetCounterConfirm"),
                () => {
                  void this.resetCounter();
                },
                t("settings.resetCounter")
              ).open();
            })
        );
      },
    };
  }

  private manageCacheSetting(): SettingDefinitionRender {
    return {
      name: t("settings.manageCache"),
      desc: t("settings.manageCacheDesc"),
      render: (setting) => {
        setting
          .setName(t("settings.manageCache"))
          .setDesc(t("settings.manageCacheDesc"))
          .addButton((btn) =>
            btn
              .setButtonText(t("settings.manageCacheButton"))
              .onClick(() => {
                const modal = new CacheCleanupModal(
                  this.plugin.app,
                  this.plugin
                );
                modal.open();
              })
          );
      },
    };
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings as unknown as Record<string, unknown>;
    if (key === "hoverTooltipDurationMs" || key === "cacheTTL") {
      return String(s[key]);
    }
    return s[key];
  }

  setControlValue(key: string, value: unknown): void | Promise<void> {
    const s = this.plugin.settings;
    switch (key) {
      case "language": {
        const lang = String(value);
        if (lang !== "auto" && lang !== "en" && lang !== "it") return;
        s.language = lang;
        this.plugin.setLanguage(lang);
        return this.plugin.saveSettings().then(() => {
          this.update();
        });
      }
      case "hoverTooltipDurationMs":
        s.hoverTooltipDurationMs = parseInt(String(value), 10);
        break;
      case "cacheTTL":
        s.cacheTTL = parseInt(String(value), 10);
        break;
      case "cacheFolder":
        s.cacheFolder = String(value) || "cards4links-cache";
        break;
      case "defaultView": {
        const v = String(value);
        if (!isCardView(v)) return;
        s.defaultView = v;
        break;
      }
      case "theme": {
        const v = String(value);
        if (!isCardTheme(v)) return;
        s.theme = v;
        break;
      }
      case "thumbnailPosition": {
        const v = String(value);
        if (!isThumbnailPosition(v)) return;
        s.thumbnailPosition = v;
        break;
      }
      case "cacheLocation": {
        const v = String(value);
        if (!isCacheLocation(v)) return;
        s.cacheLocation = v;
        break;
      }
      default:
        (s as unknown as Record<string, unknown>)[key] = value;
    }
    void this.plugin.saveSettings();
    if (
      key === "hoverEnhance" ||
      key === "cacheImages" ||
      key === "cacheLocation"
    ) {
      this.refreshDomState();
    }
  }

  private async resetCounter(): Promise<void> {
    this.plugin.settings.cardsCreated = 0;
    this.plugin.settings.milestonesShown = [];
    await this.plugin.saveSettings();
    this.update();
  }
}