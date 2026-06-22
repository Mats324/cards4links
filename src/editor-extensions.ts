import { Editor, EditorPosition } from "obsidian";
import { linkLineRegex, lineUrlRegex } from "./utils";

interface WordBoundaries {
  start: { line: number; ch: number };
  end: { line: number; ch: number };
}

export class EditorExtensions {
  static getSelectedText(editor: Editor): string {
    if (!editor.somethingSelected()) {
      const bounds = this.getWordBoundaries(editor);
      editor.setSelection(bounds.start, bounds.end);
    }
    return editor.getSelection();
  }

  static posFromIndex(content: string, index: number): EditorPosition {
    const substr = content.substring(0, index);
    let line = 0;
    let offset = -1;
    let r = -1;
    for (; (r = substr.indexOf("\n", r + 1)) !== -1; line++, offset = r);
    offset += 1;
    const ch = index - offset;
    return { line, ch };
  }

  private static isCursorInRange(
    cursor: EditorPosition,
    match: RegExpMatchArray
  ): boolean {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    return start <= cursor.ch && cursor.ch <= end;
  }

  private static getWordBoundaries(editor: Editor): WordBoundaries {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);

    for (const match of lineText.matchAll(linkLineRegex)) {
      if (this.isCursorInRange(cursor, match)) {
        const startCh = match.index ?? 0;
        return {
          start: { line: cursor.line, ch: startCh },
          end: { line: cursor.line, ch: startCh + match[0].length },
        };
      }
    }

    for (const match of lineText.matchAll(lineUrlRegex)) {
      if (this.isCursorInRange(cursor, match)) {
        const startCh = match.index ?? 0;
        return {
          start: { line: cursor.line, ch: startCh },
          end: { line: cursor.line, ch: startCh + match[0].length },
        };
      }
    }

    return { start: cursor, end: cursor };
  }
}
