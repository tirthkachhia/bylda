import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../Markdown";

const render = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("Markdown", () => {
  it("renders bold, bullets and paragraphs instead of raw markers", () => {
    const html = render("**Key risk**\n\n- First point\n- Second point\n\nNext action: call back.");
    expect(html).toContain("<strong>Key risk</strong>");
    expect(html).toContain("<li");
    expect(html).toContain("First point");
    expect(html).not.toContain("**");
    expect(html).not.toContain("- First");
  });

  it("renders headings as emphasized paragraphs so cards keep their own outline", () => {
    const html = render("## What happened\nThe customer cooled.");
    expect(html).not.toContain("<h2");
    expect(html).toContain("What happened");
    expect(html).toContain("font-semibold");
  });

  it("shows raw HTML as text instead of rendering it", () => {
    const html = render('Hello <img src=x onerror="alert(1)"> world');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("opens links in a new tab", () => {
    const html = render("See [source](https://example.com).");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("renders GFM tables", () => {
    const html = render("| Rep | Calls |\n| --- | --- |\n| Dana | 4 |");
    expect(html).toContain("<table");
    expect(html).toContain("<td");
    expect(html).toContain("Dana");
  });
});
