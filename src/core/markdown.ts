/**
 * Minimal, dependency-free Markdown ⇄ HTML conversion for issue descriptions.
 *
 * `markdownToHtml` escapes all raw HTML in the input first, then applies a
 * conservative Markdown subset: headings, paragraphs, bold/italic/inline code,
 * links, unordered/ordered lists, blockquotes, and fenced code blocks.
 *
 * `htmlToMarkdown` converts the subset of HTML Plane stores back to Markdown.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Inline Markdown: code, bold, italic, links. Input must already be HTML-escaped. */
function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown
    .replace(/^\uFEFF/, "")
    .replace(/\r\n|\r/g, "\n")
    .split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${inlineMarkdown(escapeHtml(paragraph.join(" ")))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${list.items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push(`<blockquote><p>${inlineMarkdown(escapeHtml(quote.join(" ")))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (code !== null) {
      if (line.trim().startsWith("```")) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushAll();
      code = [];
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      flushAll();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdown(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }
    const bullet = /^(?:[-*+])\s+(.*)$/.exec(line.trim());
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.ordered) flushList();
      list = list ?? { ordered: false, items: [] };
      list.items.push(inlineMarkdown(escapeHtml(bullet[1].trim())));
      continue;
    }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line.trim());
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || !list.ordered) flushList();
      list = list ?? { ordered: true, items: [] };
      list.items.push(inlineMarkdown(escapeHtml(ordered[1].trim())));
      continue;
    }
    const quoteLine = /^>\s?(.*)$/.exec(line.trim());
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  if (code !== null) {
    blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  }
  flushAll();
  return blocks.join("");
}

export function htmlToMarkdown(html: string): string {
  let text = html.replace(/\r\n|\r/g, "\n");
  // Fenced code blocks first so their contents are not further transformed.
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_m, code: string) => {
    return `\n\n\`\`\`\n${unescapeHtml(code.replace(/<[^>]+>/g, ""))}\n\`\`\`\n\n`;
  });
  // Inline formatting first so block handlers below can strip any remaining tags.
  text = text
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const clean = label.replace(/<[^>]+>/g, "").trim();
      return href && clean ? `[${clean}](${href})` : clean;
    });
  text = text
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
      return `\n\n${"#".repeat(Number(level))} ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`;
    })
    .replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_m, inner: string) => `\n- ${inner.replace(/<[^>]+>/g, "").trim()}`,
    )
    .replace(/<\/?[uo]l[^>]*>/gi, "\n")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
      const body = inner.replace(/<[^>]+>/g, "").trim();
      return `\n\n${body
        .split("\n")
        .map((line) => `> ${line.trim()}`)
        .join("\n")}\n\n`;
    })
    .replace(/<p[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = unescapeHtml(text);
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
