import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

marked.use({
  gfm: true,
  breaks: true,
});

export default function MarkdownContent({ content }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content || "")),
    [content],
  );

  return (
    <div
      className="chat-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
