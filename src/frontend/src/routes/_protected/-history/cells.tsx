import { useRouter, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Check,
	ExternalLink,
	FileText,
	Globe,
	LinkIcon,
	Lock,
	Type,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function formatRelativeTime(ttl: number): string {
	const now = Math.floor(Date.now() / 1000);
	const diff = ttl - now;

	if (diff <= 0) return "Expired";

	const minutes = Math.floor(diff / 60);
	const hours = Math.floor(diff / 3600);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d`;
	if (hours > 0) return `${hours}h`;
	if (minutes > 0) return `${minutes}m`;
	return "<1m";
}

export function formatAbsoluteExpiry(ttl: number): string {
	if (ttl == null || ttl === 0) return "—";
	
	const date = new Date(ttl * 1000);
	const now = Math.floor(Date.now() / 1000);
	
	if (ttl <= now) {
		return `Expired ${date.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})}`;
	}
	
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatDate(epoch: number): string {
	return new Date(epoch * 1000).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function StatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		AVAILABLE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25",
		PENDING_UPLOAD: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25",
		CONSUMED: "bg-muted text-muted-foreground border-border",
		EXPIRED: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/25",
	};
	const label = status === "PENDING_UPLOAD" ? "Pending" : status.charAt(0) + status.slice(1).toLowerCase();

	return (
		<span
			className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${styles[status] || "bg-muted text-muted-foreground border-border"}`}
		>
			{label}
		</span>
	);
}

export function TypeBadge({ type }: { type: string }) {
	const isFile = type === "FILE";
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${isFile ? "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/25" : "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/25"}`}
		>
			{isFile ? <FileText className="size-3" /> : <Type className="size-3" />}
			{type}
		</span>
	);
}

export function VisibilityBadge({ visibility }: { visibility: string }) {
	const isPublic = visibility === "public";
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${isPublic ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25" : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/25"}`}
		>
			{isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}
			{visibility}
		</span>
	);
}

export function SortHeader({ column, label }: { column: any; label: string }) {
	const sorted = column.getIsSorted();
	return (
		<button
			type="button"
			onClick={column.getToggleSortingHandler()}
			className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
		>
			{label}
			{sorted === "asc" ? (
				<ArrowUp className="size-3" />
			) : sorted === "desc" ? (
				<ArrowDown className="size-3" />
			) : (
				<ArrowUpDown className="size-3 opacity-40" />
			)}
		</button>
	);
}

function CopyLinkButton({ shareId }: { shareId: string }) {
	const router = useRouter();
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		const { pathname } = router.buildLocation({
			to: "/s/$shareId",
			params: { shareId },
		});
		const url = `${window.location.origin}${pathname}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		toast.success("Link copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
			title="Copy share link"
		>
			{copied ? <Check className="size-3.5 text-emerald-500" /> : <LinkIcon className="size-3.5" />}
		</button>
	);
}

export function ActionsCell({ shareId }: { shareId: string }) {
	return (
		<div className="flex items-center gap-1">
			<CopyLinkButton shareId={shareId} />
			<Link
				to="/s/$shareId"
				params={{ shareId }}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				title="View share"
			>
				<ExternalLink className="size-3.5" />
			</Link>
		</div>
	);
}
