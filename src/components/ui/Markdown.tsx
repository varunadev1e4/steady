import ReactMarkdown from 'react-markdown';
import { cn } from '@/utils/cn';

/**
 * Renders user Markdown safely: react-markdown builds React elements (no
 * dangerouslySetInnerHTML), ignores raw HTML, and strips unsafe link
 * protocols such as javascript:.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-steady', className)}>
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
