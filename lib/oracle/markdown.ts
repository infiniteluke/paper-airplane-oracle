import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "code",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
  ],
  allowedAttributes: { a: ["href", "title"] },
  allowedSchemes: ["http", "https", "mailto"],
};

export function renderOracleMarkdown(source: string): string {
  const html = marked.parse(source, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
