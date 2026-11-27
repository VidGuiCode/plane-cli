import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "../../src/core/markdown.js";

describe("markdownToHtml", () => {
  it("converts headings, paragraphs, and inline formatting", () => {
    const html = markdownToHtml("# Title\n\nSome **bold** and *italic* and `code`.");
    expect(html).toBe(
      "<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> and <code>code</code>.</p>",
    );
  });

  it("converts unordered and ordered lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(markdownToHtml("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("converts links, blockquotes, and fenced code blocks", () => {
    expect(markdownToHtml("[docs](https://plane.so)")).toBe(
      '<p><a href="https://plane.so">docs</a></p>',
    );
    expect(markdownToHtml("> quoted")).toBe("<blockquote><p>quoted</p></blockquote>");
    expect(markdownToHtml("```\nlet x = 1 < 2;\n```")).toBe(
      "<pre><code>let x = 1 &lt; 2;</code></pre>",
    );
  });

  it("escapes raw HTML in the input", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings, paragraphs, lists, and inline formatting back", () => {
    const md = htmlToMarkdown(
      "<h2>Plan</h2><p>Ship <strong>it</strong> and <em>test</em>.</p><ul><li>one</li><li>two</li></ul>",
    );
    expect(md).toBe("## Plan\n\nShip **it** and *test*.\n\n- one\n- two");
  });

  it("converts links, blockquotes, and code blocks", () => {
    expect(htmlToMarkdown('<p><a href="https://plane.so">docs</a></p>')).toBe(
      "[docs](https://plane.so)",
    );
    expect(htmlToMarkdown("<blockquote><p>quoted</p></blockquote>")).toBe("> quoted");
    expect(htmlToMarkdown("<pre><code>let x = 1 &lt; 2;</code></pre>")).toBe("```\nlet x = 1 < 2;\n```");
  });

  it("round-trips a structured document", () => {
    const md = "# Release\n\n- **ship** the build\n- run tests\n\nSee [docs](https://plane.so).";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });
});
