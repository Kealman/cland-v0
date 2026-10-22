import { createElement, useContext } from 'react';
import { ItemNavigation, ItemText } from './ItemText.tsx';
import { parseMarkdown, type MarkdownInline } from './markdown.ts';
import s from './MarkdownBody.module.css';

function Inline({ tokens }: { tokens: MarkdownInline[] }) {
  return tokens.map((token, index) => {
    switch (token.kind) {
      case 'text': return token.text;
      case 'item': return <ItemText key={index} text={token.id} />;
      case 'code': return <code key={index}>{token.text}</code>;
      case 'strong': return <strong key={index}><Inline tokens={token.children} /></strong>;
      case 'em': return <em key={index}><Inline tokens={token.children} /></em>;
      case 'link': return <a key={index} href={token.href} target="_blank" rel="noopener noreferrer">{token.text}</a>;
    }
  });
}

/** Each message is parsed separately; tokens become only elements and text. */
export function MarkdownBody({ text }: { text: string }) {
  const { prefixes } = useContext(ItemNavigation);
  return <div className={s.markdown}>{parseMarkdown(text, { itemPrefixes: prefixes }).map((block, index) => {
    switch (block.kind) {
      case 'paragraph': return <p key={index}><Inline tokens={block.children} /></p>;
      case 'heading': return createElement(`h${block.level}`, { key: index }, <Inline tokens={block.children} />);
      case 'quote': return <blockquote key={index}><Inline tokens={block.children} /></blockquote>;
      case 'table': return <pre key={index}>{block.text}</pre>;
      case 'code': return <div key={index} className={s.code}>{block.language && <div data-code-language className={s.language}>{block.language}</div>}<pre><code>{block.text}</code></pre></div>;
      case 'list': {
        const items = block.items.map((tokens, i) => <li key={i}><Inline tokens={tokens} /></li>);
        return block.ordered ? <ol key={index} start={block.start}>{items}</ol> : <ul key={index}>{items}</ul>;
      }
    }
  })}</div>;
}
