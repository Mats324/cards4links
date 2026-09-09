import { moment } from "obsidian";

export type Lang = "en" | "it";
export type LanguageSetting = "auto" | Lang;

const en = {
  "command.pasteAndEnhance": "Paste URL and enhance to card link",
  "command.upgradeOldCards": "Add view field to old cardlink cards",
  "command.enhanceSelected": "Enhance selected URL to card link",
  "command.createCarousel": "Create carousel from selected URLs",
  "command.openSettings": "Open plugin settings",

  "notice.welcome":
    "Cards4Links activated! Paste a URL into a note, or select a URL and press Mod+Shift+E.",
  "milestone.1":
    "First card created! 🎉 Enable 'Enhance default paste' in settings to convert URLs automatically on paste.",
  "milestone.3":
    "3 cards created! Select 2+ URLs and press Mod+Shift+C to build a carousel.",
  "milestone.5":
    "5 cards created! 🎉 Thanks for using Cards4Links! https://github.com/Mats324/cards4links",
  "milestone.10":
    "10 cards created! Try a card theme (light/dark) in settings for a different look.",
  "milestone.25":
    "25 cards created! Enable the 'watched/read' checkbox to track videos and articles.",
  "milestone.50":
    "50 cards created! Explore other card views (compact, minimal) to save space.",
  "milestone.100":
    "100 cards created! Turn on 'Cache images locally' to keep card images available offline.",
  "notice.selectTwoUrls": "Cards4Links: select 2+ URLs to create a carousel",
  "notice.noOldCards": "Cards4Links: no old cards found",
  "notice.updatedCards": "Cards4Links: updated {count} card(s)",

  "notice.fetchingMetadata": "Cards4Links: fetching metadata...",
  "notice.fetchFailed": "Cards4Links: couldn't fetch link metadata",
  "notice.fetchingMetadataGroup":
    "Cards4Links: fetching metadata for {count} links...",
  "notice.fetchFailedAll": "Cards4Links: couldn't fetch any link metadata",
  "notice.createdCarousel":
    "Cards4Links: created carousel with {count} cards",

  "notice.urlCopied": "URL copied to clipboard",
  "notice.cannotEditReading": "Cards4Links: cannot edit in Reading view",
  "notice.errorUpdatingCard": "Cards4Links: error updating card state",
  "notice.imageLoadFailed":
    "Failed to load image. Please try a different URL.",

  "error.yamlParse":
    "Failed to parse YAML. Check debug console for details.",
  "error.requiredParams": "Required params [url, title] not found.",
  "error.cardlink": "cardlink error: {message}",

  "label.watched": "Watched",
  "label.read": "Read",

  "aria.carousel": "Card carousel",
  "aria.carouselRoledescription": "carousel",
  "aria.slideRoledescription": "slide",
  "aria.slideOf": "Slide {current} of {total}",
  "aria.slideNavigation": "Slide navigation",
  "aria.goToSlide": "Go to slide {index}",
  "aria.previousSlide": "Previous slide",
  "aria.nextSlide": "Next slide",
  "aria.addViewField": "Add view field to card",
  "aria.view": "View: {view}",
  "aria.markAs": "Mark as {label}",
  "aria.markUnread": "Mark as Unread",
  "aria.copyUrl": "Copy URL\n{url}",

  "placeholder.setImage": "Set image",
  "placeholder.addDescription": "Add description",

  "modal.setImageTitle": "Set card image",
  "modal.imageUrl": "Image URL",
  "modal.imageUrlDesc": "Enter or paste a URL for the card image",
  "modal.pasteFromClipboard": "Paste from clipboard",
  "modal.setDescriptionTitle": "Set card description",
  "modal.description": "Description",
  "ui.save": "Save",
  "ui.cancel": "Cancel",

  "settings.language": "Language",
  "settings.languageDesc":
    "Interface language (auto follows the Obsidian language)",
  "settings.language.auto": "Auto",
  "settings.language.en": "English",
  "settings.language.it": "Italiano",
  "settings.cardsCreated": "Cards created",
  "settings.cardsCreatedDesc":
    "Number of cards generated with Cards4Links since the last reset: {count}",
  "settings.resetCounter": "Reset counter",
  "settings.resetCounterConfirm":
    "Reset the card counter? This will also restart the milestone notifications.",
  "settings.enhancePaste": "Enhance default paste",
  "settings.enhancePasteDesc":
    "Automatically fetch metadata when pasting a URL with the default paste command",
  "settings.thumbnailPosition": "Thumbnail position",
  "settings.thumbnailPositionDesc": "Where to show the thumbnail image in the card",
  "settings.thumbnail.right": "Right",
  "settings.thumbnail.left": "Left",
  "settings.thumbnail.none": "No thumbnail",
  "settings.showInMenu": "Show commands in menu item",
  "settings.showInMenuDesc":
    "Add paste/enhance commands to the right-click context menu",
  "settings.enableWatched": "Enable watched/read checkbox",
  "settings.enableWatchedDesc":
    "Show a checkbox on cards to track watched (video) or read (article) status",
  "settings.defaultView": "Default card view",
  "settings.defaultViewDesc": "Default view style for newly created cards",
  "settings.view.card": "Card",
  "settings.view.compact": "Compact",
  "settings.view.minimal": "Minimal",
  "settings.view.carousel": "Carousel",
  "settings.theme": "Card theme",
  "settings.themeDesc": "Override card colors (default follows Obsidian theme)",
  "settings.theme.default": "Default",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.cacheImages": "Cache images locally",
  "settings.cacheImagesDesc":
    "Download card images to the vault for offline access",
  "settings.cacheStorage": "Cache storage",
  "settings.cacheStorageDesc":
    "Store images in a global vault folder or next to each note",
  "settings.cacheLocation.vault": "Global folder",
  "settings.cacheLocation.note": "Per note",
  "settings.cacheFolder": "Cache folder name",
  "settings.cacheFolderDesc": "Folder path for cached images (vault root)",
  "settings.cacheTtl": "Cache TTL",
  "settings.cacheTtlDesc": "How long before re-downloading a cached image",
  "settings.ttl.7": "7 days",
  "settings.ttl.30": "30 days",
  "settings.ttl.90": "90 days",
  "settings.ttl.180": "180 days",
  "settings.ttl.0": "Never expire",
  "settings.manageCache": "Manage cache",
  "settings.manageCacheDesc": "View cache contents and clean up files",
  "settings.manageCacheButton": "Manage cache…",

  "cache.title": "Cache Cleanup",
  "cache.scanning": "Scanning cache…",
  "cache.summary": "{count} files — {size}",
  "cache.summaryExpired": " — {count} expired",
  "cache.selectAll": "Select all",
  "cache.selectExpired": "Select expired",
  "cache.selectOrphans": "Select orphans",
  "cache.deselectAll": "Deselect all",
  "cache.headerFile": "File",
  "cache.headerSize": "Size",
  "cache.headerAge": "Age",
  "cache.orphan": "orphan",
  "cache.expired": "expired",
  "cache.ok": "ok",
  "cache.deleteSelected": "Delete selected",
  "notice.noFilesSelected": "No files selected",
  "notice.deletedFiles": "Deleted {count} file(s)",
  "cache.age.today": "today",
  "cache.age.oneDay": "1 day",
  "cache.age.days": "{days} days",
  "cache.age.oneMonth": "1 month",
  "cache.age.months": "{months} months",
};

export type Translations = Record<keyof typeof en, string>;
export type TKey = keyof typeof en;

const it: Translations = {
  "command.pasteAndEnhance": "Incolla URL e converti in card link",
  "command.upgradeOldCards": "Aggiungi campo view alle card cardlink datate",
  "command.enhanceSelected": "Converti l'URL selezionato in card link",
  "command.createCarousel": "Crea carosello dagli URL selezionati",
  "command.openSettings": "Apri le impostazioni del plugin",

  "notice.welcome":
    "Cards4Links attivato! Incolla un URL in una nota, oppure seleziona un URL e premi Mod+Shift+E.",
  "milestone.1":
    "Prima card creata! 🎉 Attiva 'Migliora incolla predefinito' nelle impostazioni per convertire automaticamente gli URL in card all'incolla.",
  "milestone.3":
    "3 card create! Seleziona 2+ URL e premi Mod+Shift+C per creare un carosello.",
  "milestone.5":
    "5 card create! 🎉 Grazie per usare Cards4Links! https://github.com/Mats324/cards4links",
  "milestone.10":
    "10 card create! Prova un tema card (chiaro/scuro) nelle impostazioni per un aspetto diverso.",
  "milestone.25":
    "25 card create! Attiva la checkbox 'guardato/letto' per monitorare video e articoli.",
  "milestone.50":
    "50 card create! Esplora le altre viste card (compatta, minimale) per risparmiare spazio.",
  "milestone.100":
    "100 card create! Attiva 'Salva immagini localmente' per mantenere le immagini delle card disponibili offline.",
  "notice.selectTwoUrls": "Cards4Links: seleziona 2+ URL per creare un carosello",
  "notice.noOldCards": "Cards4Links: nessuna card datata trovata",
  "notice.updatedCards": "Cards4Links: aggiornate {count} card",

  "notice.fetchingMetadata": "Cards4Links: recupero metadati...",
  "notice.fetchFailed": "Cards4Links: impossibile recuperare i metadati del link",
  "notice.fetchingMetadataGroup":
    "Cards4Links: recupero metadati per {count} link...",
  "notice.fetchFailedAll":
    "Cards4Links: impossibile recuperare i metadati di alcun link",
  "notice.createdCarousel":
    "Cards4Links: carosello creato con {count} card",

  "notice.urlCopied": "URL copiato negli appunti",
  "notice.cannotEditReading": "Cards4Links: impossibile modificare in Visualizzazione Lettura",
  "notice.errorUpdatingCard": "Cards4Links: errore durante l'aggiornamento della card",
  "notice.imageLoadFailed":
    "Impossibile caricare l'immagine. Prova con un URL diverso.",

  "error.yamlParse":
    "Impossibile analizzare lo YAML. Controlla la console di debug per i dettagli.",
  "error.requiredParams": "Parametri obbligatori [url, title] non trovati.",
  "error.cardlink": "errore cardlink: {message}",

  "label.watched": "Visto",
  "label.read": "Letto",

  "aria.carousel": "Carosello di card",
  "aria.carouselRoledescription": "carosello",
  "aria.slideRoledescription": "slide",
  "aria.slideOf": "Slide {current} di {total}",
  "aria.slideNavigation": "Navigazione slide",
  "aria.goToSlide": "Vai alla slide {index}",
  "aria.previousSlide": "Slide precedente",
  "aria.nextSlide": "Slide successiva",
  "aria.addViewField": "Aggiungi campo view alla card",
  "aria.view": "Vista: {view}",
  "aria.markAs": "Segna come {label}",
  "aria.markUnread": "Segna come Non Letto",
  "aria.copyUrl": "Copia URL\n{url}",

  "placeholder.setImage": "Imposta immagine",
  "placeholder.addDescription": "Aggiungi descrizione",

  "modal.setImageTitle": "Imposta immagine della card",
  "modal.imageUrl": "URL immagine",
  "modal.imageUrlDesc": "Inserisci o incolla l'URL per l'immagine della card",
  "modal.pasteFromClipboard": "Incolla dagli appunti",
  "modal.setDescriptionTitle": "Imposta descrizione della card",
  "modal.description": "Descrizione",
  "ui.save": "Salva",
  "ui.cancel": "Annulla",

  "settings.language": "Lingua",
  "settings.languageDesc":
    "Lingua dell'interfaccia (auto segue la lingua di Obsidian)",
  "settings.language.auto": "Auto",
  "settings.language.en": "English",
  "settings.language.it": "Italiano",
  "settings.cardsCreated": "Card create",
  "settings.cardsCreatedDesc":
    "Numero di card generate con Cards4Links dall'ultimo reset: {count}",
  "settings.resetCounter": "Azzera contatore",
  "settings.resetCounterConfirm":
    "Azzera il contatore delle card? Verranno riattivate anche le notifiche dei traguardi.",
  "settings.enhancePaste": "Migliora incolla predefinito",
  "settings.enhancePasteDesc":
    "Recupera automaticamente i metadati quando incolli un URL con il comando di incolla predefinito",
  "settings.thumbnailPosition": "Posizione anteprima",
  "settings.thumbnailPositionDesc": "Dove mostrare l'immagine di anteprima nella card",
  "settings.thumbnail.right": "Destra",
  "settings.thumbnail.left": "Sinistra",
  "settings.thumbnail.none": "Nessuna anteprima",
  "settings.showInMenu": "Mostra comandi nel menu contestuale",
  "settings.showInMenuDesc":
    "Aggiungi i comandi incolla/converti al menu contestuale del tasto destro",
  "settings.enableWatched": "Attiva checkbox visto/letto",
  "settings.enableWatchedDesc":
    "Mostra una checkbox sulle card per monitorare lo stato visto (video) o letto (articolo)",
  "settings.defaultView": "Vista predefinita della card",
  "settings.defaultViewDesc": "Stile di vista predefinito per le nuove card",
  "settings.view.card": "Card",
  "settings.view.compact": "Compatta",
  "settings.view.minimal": "Minimale",
  "settings.view.carousel": "Carosello",
  "settings.theme": "Tema card",
  "settings.themeDesc": "Sovrascrivi i colori delle card (predefinito segue il tema di Obsidian)",
  "settings.theme.default": "Predefinito",
  "settings.theme.light": "Chiaro",
  "settings.theme.dark": "Scuro",
  "settings.cacheImages": "Salva immagini localmente",
  "settings.cacheImagesDesc":
    "Scarica le immagini delle card nel vault per l'accesso offline",
  "settings.cacheStorage": "Archiviazione cache",
  "settings.cacheStorageDesc":
    "Salva le immagini in una cartella globale del vault o accanto a ogni nota",
  "settings.cacheLocation.vault": "Cartella globale",
  "settings.cacheLocation.note": "Per nota",
  "settings.cacheFolder": "Nome cartella cache",
  "settings.cacheFolderDesc": "Percorso cartella per le immagini in cache (root del vault)",
  "settings.cacheTtl": "TTL cache",
  "settings.cacheTtlDesc": "Dopo quanto tempo riscaricare un'immagine in cache",
  "settings.ttl.7": "7 giorni",
  "settings.ttl.30": "30 giorni",
  "settings.ttl.90": "90 giorni",
  "settings.ttl.180": "180 giorni",
  "settings.ttl.0": "Mai",
  "settings.manageCache": "Gestisci cache",
  "settings.manageCacheDesc": "Visualizza il contenuto della cache e ripulisci i file",
  "settings.manageCacheButton": "Gestisci cache…",

  "cache.title": "Pulizia cache",
  "cache.scanning": "Analisi cache in corso…",
  "cache.summary": "{count} file — {size}",
  "cache.summaryExpired": " — {count} scaduti",
  "cache.selectAll": "Seleziona tutto",
  "cache.selectExpired": "Seleziona scaduti",
  "cache.selectOrphans": "Seleziona orfani",
  "cache.deselectAll": "Deseleziona tutto",
  "cache.headerFile": "File",
  "cache.headerSize": "Dimensione",
  "cache.headerAge": "Età",
  "cache.orphan": "orfano",
  "cache.expired": "scaduto",
  "cache.ok": "ok",
  "cache.deleteSelected": "Elimina selezionati",
  "notice.noFilesSelected": "Nessun file selezionato",
  "notice.deletedFiles": "Eliminati {count} file",
  "cache.age.today": "oggi",
  "cache.age.oneDay": "1 giorno",
  "cache.age.days": "{days} giorni",
  "cache.age.oneMonth": "1 mese",
  "cache.age.months": "{months} mesi",
};

const dictionaries: Record<Lang, Translations> = { en, it };

let currentLang: Lang = "en";

export function setLanguage(lang: Lang): void {
  currentLang = lang;
}

export function detectLang(): Lang {
  let locale = "";
  try {
    locale = moment.locale();
  } catch {
    locale = navigator?.language ?? "";
  }
  if (!locale) locale = navigator?.language ?? "";
  return locale.toLowerCase().startsWith("it") ? "it" : "en";
}

export function resolveLang(setting: LanguageSetting): Lang {
  if (setting === "en" || setting === "it") return setting;
  return detectLang();
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  let str = dictionaries[currentLang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.split(`{${name}}`).join(String(value));
    }
  }
  return str;
}