import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { CopyButton } from "./CopyButton";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** react-markdown renders fences as <pre><code class="language-x">: wrap them with the language and a copy button. */
export function CodeBlock({ children }: ComponentProps<"pre">) {
  const code = isValidElement(children) ? (children as ReactElement<{ className?: string }>) : null;
  const lang = /language-([\w+#.-]+)/.exec(code?.props.className ?? "")?.[1];

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang ?? "código"}</span>
        <CopyButton
          text={textOf(children).replace(/\n$/, "")}
          label="Copiar código"
          className="text-[color:var(--code-muted)] hover:bg-white/10 hover:text-[color:var(--code-fg)]"
        />
      </div>
      <pre>{children}</pre>
    </div>
  );
}
