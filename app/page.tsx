import Link from "next/link";

const tools = [
  {
    href: "/tools/md-to-docx",
    title: "MD → DOCX",
    description: "将 Markdown 文件转换为 Microsoft Word (.docx) 文档，支持自定义样式。",
    gradient: "from-blue-600 to-blue-400",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    href: "/tools/pdf-stamp",
    title: "PDF 盖章",
    description: "在 PDF 文档上盖自定义图章。支持点击放置和骑缝章——全浏览器处理，无需上传。",
    gradient: "from-red-600 to-rose-400",
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2" />
        <line x1="7" y1="17" x2="17" y2="17" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white dark:bg-white dark:text-zinc-900">
              T
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                工具箱
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                企业文档处理工具
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            企业级工具箱
          </h2>
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
            浏览器端文档处理工具集。
            你的文件始终留在本地。
          </p>
        </div>
      </section>

      {/* Tool Grid */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* Icon */}
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white ${tool.gradient}`}
              >
                {tool.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tool.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {tool.description}
              </p>

              {/* Arrow */}
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-zinc-900 transition-all group-hover:gap-2 dark:text-zinc-50">
                <span>打开</span>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}

          {/* Placeholder — more tools coming soon */}
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              更多工具即将推出
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            所有处理均在浏览器中完成，数据不上传至任何服务器。
          </p>
        </div>
      </footer>
    </div>
  );
}
