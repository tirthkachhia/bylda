// Renders model-written text (chat answers, call summaries) as formatted
// markdown instead of raw "**bold**" and "- bullets". Raw HTML in the text is
// shown as text, never rendered, so model output cannot inject markup.
// Headings are rendered as emphasized paragraphs: the surrounding cards own the
// document outline and style their own h2/h3.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const heading: Components["p"] = ({ node: _node, ...props }) => (
  <p className="mt-3 font-semibold first:mt-0" {...props} />
);

const components: Components = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="leading-6" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a className="underline" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={`rounded bg-black/[0.06] px-1 font-mono text-[0.9em] ${className ?? ""}`}
      {...props}
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-black/[0.06] p-3 text-xs" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 border-black/[0.15] pl-3" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <table className="my-2 border-collapse text-xs" {...props} />
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border border-black/[0.1] px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border border-black/[0.1] px-2 py-1" {...props} />
  ),
};

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
