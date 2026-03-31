import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClassName?: string;
  actions?: ReactNode;
};

export function AppShell({
  title,
  description,
  children,
  maxWidthClassName = "max-w-5xl",
  actions,
}: AppShellProps) {
  return (
    <div className="min-h-screen px-4 py-10 bg-zinc-50 dark:bg-black">
      <div className={`${maxWidthClassName} mx-auto`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
            {description ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>

        {children}
      </div>
    </div>
  );
}

