import type { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox, SearchX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { useDataStatus } from "@/lib/data-status";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* 1. LOADING                                                          */
/* ------------------------------------------------------------------ */

export function LoadingState({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label ?? t("states.loading")}</p>
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 py-2", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. ERROR                                                            */
/* ------------------------------------------------------------------ */

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">{title ?? t("states.errorTitle")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description ?? t("states.errorDesc")}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {t("states.retry")}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. EMPTY (genuinely empty vs. no filter results)                    */
/* ------------------------------------------------------------------ */

export function EmptyStateBlock({
  icon: Icon = Inbox,
  titleKey,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: LucideIcon;
  /** Key inside the `states` i18n namespace, e.g. "emptyDrivers".
   *  Resolves `states.<key>` as title and `states.<key>Desc` as description. */
  titleKey?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? (titleKey ? t(`states.${titleKey}`) : "");
  const resolvedDesc = description ?? (titleKey ? t(`states.${titleKey}Desc`) : undefined);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold">{resolvedTitle}</h3>
      {resolvedDesc && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{resolvedDesc}</p>}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function NoResultsState({
  onClear,
  className,
}: {
  onClear?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold">{t("states.noResultsTitle")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("states.noResultsDesc")}</p>
      {onClear && (
        <Button variant="outline" className="mt-5" onClick={onClear}>
          {t("states.clearFilters")}
        </Button>
      )}
    </div>
  );
}

/**
 * One place that decides which of the 4 states a list renders.
 * `total` = number of items before filtering, `count` = after filtering.
 */
export function ListState({
  total,
  count,
  loading,
  error,
  onRetry,
  onClearFilters,
  icon,
  emptyKey,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  skeletonRows,
  children,
}: {
  total: number;
  count?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onClearFilters?: () => void;
  icon?: LucideIcon;
  emptyKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  skeletonRows?: number;
  children: ReactNode;
}) {
  const data = useDataStatus();
  const isLoading = loading ?? (data.isLoading && total === 0);
  const isError = !!error || (data.isError && total === 0);
  const shown = count ?? total;

  if (isLoading) return <ListSkeleton rows={skeletonRows} />;
  if (isError) return <ErrorState onRetry={onRetry ?? data.retry} />;
  if (total === 0)
    return (
      <EmptyStateBlock
        icon={icon}
        titleKey={emptyKey}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  if (shown === 0) return <NoResultsState onClear={onClearFilters} />;
  return <>{children}</>;
}

/** Table-body equivalent of ListState for `<Table>` layouts. */
export function TableState({
  colSpan,
  total,
  count,
  emptyKey,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onClearFilters,
  onRetry,
  children,
}: {
  colSpan: number;
  total: number;
  count?: number;
  emptyKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onClearFilters?: () => void;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const data = useDataStatus();
  const shown = count ?? total;

  if (data.isLoading && total === 0) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell colSpan={colSpan}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }
  if (data.isError && total === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="p-0">
          <ErrorState className="border-0 bg-transparent" onRetry={onRetry ?? data.retry} />
        </TableCell>
      </TableRow>
    );
  }
  if (total === 0 || shown === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="p-0">
          {total === 0 ? (
            <EmptyStateBlock
              titleKey={emptyKey}
              title={emptyTitle}
              description={emptyDescription}
              actionLabel={emptyActionLabel}
              onAction={onEmptyAction}
              className="border-0"
            />
          ) : (
            <NoResultsState onClear={onClearFilters} className="border-0" />
          )}
        </TableCell>
      </TableRow>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* 4. SUCCESS / actions                                                */
/* ------------------------------------------------------------------ */

/** Submit button that disables itself and shows a spinner while pending,
 *  preventing double-submission. */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string }) {
  const { t } = useTranslation();
  return (
    <Button disabled={pending || disabled} {...props}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? (pendingLabel ?? t("states.saving")) : children}
    </Button>
  );
}

/** Single table row rendering a full empty (or no-results) state. */
export function TableEmpty({
  colSpan,
  titleKey,
  title,
  description,
  actionLabel,
  onAction,
  filtered,
  onClearFilters,
  icon,
}: {
  colSpan: number;
  titleKey?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  filtered?: boolean;
  onClearFilters?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        {filtered ? (
          <NoResultsState onClear={onClearFilters} className="border-0" />
        ) : (
          <EmptyStateBlock
            icon={icon}
            titleKey={titleKey}
            title={title}
            description={description}
            actionLabel={actionLabel}
            onAction={onAction}
            className="border-0"
          />
        )}
      </TableCell>
    </TableRow>
  );
}
