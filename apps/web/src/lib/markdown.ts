import MarkdownIt from 'markdown-it';

// 控制台 Markdown 渲染单例：关闭原始 HTML（防 XSS），启用 GFM 链接识别与换行；
// 外链统一新窗口打开并带 noopener。文档内容为本地受控文本，不接入用户输入。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '');
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** 渲染 Markdown 文本为受信 HTML；输入仅限本地受控文档。 */
export function renderMarkdown(src: string): string {
  return md.render(src);
}
