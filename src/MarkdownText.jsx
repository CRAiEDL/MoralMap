import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const defaultComponents = {
  p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-3 list-disc pl-5 last:mb-0" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-3 list-decimal pl-5 last:mb-0" {...props} />,
  li: ({ node, ...props }) => <li className="mb-1 last:mb-0" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-blue-600 underline decoration-blue-200 underline-offset-2 hover:text-blue-700"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  br: () => <br />,
};

export default function MarkdownText({ content, className = "", components = {} }) {
  const combinedComponents = { ...defaultComponents, ...components };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      className={className}
      components={combinedComponents}
      linkTarget="_blank"
    >
      {content || ""}
    </ReactMarkdown>
  );
}

