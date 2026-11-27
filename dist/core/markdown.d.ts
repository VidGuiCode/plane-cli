/**
 * Minimal, dependency-free Markdown ⇄ HTML conversion for issue descriptions.
 *
 * `markdownToHtml` escapes all raw HTML in the input first, then applies a
 * conservative Markdown subset: headings, paragraphs, bold/italic/inline code,
 * links, unordered/ordered lists, blockquotes, and fenced code blocks.
 *
 * `htmlToMarkdown` converts the subset of HTML Plane stores back to Markdown.
 */
export declare function markdownToHtml(markdown: string): string;
export declare function htmlToMarkdown(html: string): string;
//# sourceMappingURL=markdown.d.ts.map