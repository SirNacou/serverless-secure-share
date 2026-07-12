import { api } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import type { ShareListItem, ShareListResponse } from "#/types/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarDays,
	Check,
	Clock,
	CompassIcon,
	Copy,
	ExternalLink,
	FileText,
	Globe,
	KeyRound,
	LinkIcon,
	Loader,
	Lock,
	LogInIcon,
	Search,
	Sparkles,
	Type,
	User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/explore")({
	component: RouteComponent,
});

function formatDate(epoch: number): string {
	return new Date(epoch * 1000).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatRelativeTime(ttl: number): string {
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

function TypeBadge({ type }: { type: string }) {
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

function VisibilityBadge({ visibility }: { visibility: string }) {
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

function ShareCard({ share }: { share: ShareListItem }) {
	const [copied, setCopied] = useState(false);
	const [copiedCode, setCopiedCode] = useState(false);
	const shareUrl = `${window.location.origin}/s/${share.link_id}`;

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			toast.success("Link copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy link");
		}
	};

	const handleCopyCode = async () => {
		try {
			await navigator.clipboard.writeText(share.link_id);
			setCopiedCode(true);
			toast.success("Code copied");
			setTimeout(() => setCopiedCode(false), 2000);
		} catch {
			toast.error("Failed to copy code");
		}
	};

	return (
		<div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
			<div className="flex items-start justify-between gap-2">
				<Link
					to="/s/$shareId"
					params={{ shareId: share.link_id }}
					className="font-semibold text-sm truncate hover:text-primary transition-colors"
				>
					{share.share_name}
				</Link>
				<div className="flex items-center gap-1 shrink-0">
					<button
						type="button"
						onClick={handleCopyLink}
						className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
						title="Copy share link"
					>
						{copied ? <Copy className="size-3.5 text-emerald-500" /> : <LinkIcon className="size-3.5" />}
					</button>
					<Link
						to="/s/$shareId"
						params={{ shareId: share.link_id }}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						title="View share"
					>
						<ExternalLink className="size-3.5" />
					</Link>
				</div>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<User className="size-3" />
				<span className="truncate">{share.owner_username || "—"}</span>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<KeyRound className="size-3" />
				<code className="font-mono text-xs font-medium tracking-tight bg-muted/50 px-1 py-0.5 rounded border border-border/50">
					{share.link_id}
				</code>
				<button
					type="button"
					onClick={handleCopyCode}
					className="inline-flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
					title="Copy code"
				>
					{copiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
				</button>
			</div>

			<div className="flex items-center gap-2 flex-wrap">
				<TypeBadge type={share.asset_type} />
				<VisibilityBadge visibility={share.visibility} />
			</div>

			<div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
				<span className="inline-flex items-center gap-1">
					<CalendarDays className="size-3" />
					{share.created_at ? formatDate(share.created_at) : "—"}
				</span>
				{share.ttl != null && (
					<span className="inline-flex items-center gap-1">
						<Clock className="size-3" />
						{formatRelativeTime(share.ttl)}
					</span>
				)}
			</div>
		</div>
	);
}

function SkeletonCard() {
	return (
		<div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 animate-pulse">
			<div className="h-4 bg-muted-foreground/10 rounded w-3/4" />
			<div className="h-3 bg-muted-foreground/5 rounded w-1/2" />
			<div className="flex gap-2">
				<div className="h-5 bg-muted-foreground/5 rounded-full w-14" />
				<div className="h-5 bg-muted-foreground/5 rounded-full w-16" />
			</div>
			<div className="h-3 bg-muted-foreground/5 rounded w-full" />
		</div>
	);
}

function RouteComponent() {
	const { isAuthenticated } = useAuth();
	const [query, setQuery] = useState("");
	const debouncedQueryRef = useRef(query);
	const [effectiveQuery, setEffectiveQuery] = useState("");

	useEffect(() => {
		debouncedQueryRef.current = query;
		const timer = setTimeout(() => {
			setEffectiveQuery(query);
		}, 300);
		return () => clearTimeout(timer);
	}, [query]);

	const { data, isPending, isError, error, refetch } = useQuery({
		queryKey: ["shares", "explore", effectiveQuery],
		queryFn: () => {
			const url = effectiveQuery
				? `api/explore?q=${encodeURIComponent(effectiveQuery)}`
				: "api/explore";
			return api.get(url).json<ShareListResponse>();
		},
	});

	const shares = data?.shares ?? [];

	return (
		<div className="min-h-screen bg-background">
			<header className="flex items-center justify-between px-6 py-3 border-b border-border">
				<Link
					to="/"
					className="text-sm font-bold tracking-tight text-foreground hover:text-primary transition-colors"
				>
					Secure Share
				</Link>
				<div className="flex items-center gap-3">
					{isAuthenticated ? (
						<Link
							to="/share"
							className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
						>
							<Sparkles className="size-3.5" />
							My Shares
						</Link>
					) : (
						<Link
							to="/login"
							search={{ redirectTo: undefined }}
							className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
						>
							<LogInIcon className="size-3.5" />
							Sign In
						</Link>
					)}
				</div>
			</header>

			<div className="max-w-5xl mx-auto p-6 space-y-6">
				<div className="text-center space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">Explore</h1>
					<p className="text-sm text-muted-foreground">
						Discover public shares and content shared with you
					</p>
				</div>

				<div className="relative max-w-2xl mx-auto">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search shares by name, ID, or owner..."
						className="w-full h-12 pl-12 pr-4 text-base bg-background border border-border rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
					/>
					{isPending && (
						<Loader className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
					)}
				</div>

				{!isAuthenticated && shares.length > 0 && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-4 py-2.5">
						<CompassIcon className="size-4 shrink-0" />
						<span>
							Browsing public shares.{" "}
							<Link
								to="/login"
								search={{ redirectTo: undefined }}
								className="text-primary underline underline-offset-2 hover:no-underline"
							>
								Sign in
							</Link>{" "}
							to discover shares shared with you and manage your own.
						</span>
					</div>
				)}

				{isPending && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
					</div>
				)}

				{isError && (
					<div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
						<p className="text-sm text-destructive font-medium">
							{error instanceof Error ? error.message : "Failed to load shares"}
						</p>
						<button
							type="button"
							onClick={() => refetch()}
							className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
						>
							Retry
						</button>
					</div>
				)}

				{!isPending && !isError && shares.length === 0 && (
					<div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
						<CompassIcon className="size-16 text-muted-foreground/40 stroke-[1.2] mb-4" />
						<h2 className="text-xl font-bold tracking-tight">
							{effectiveQuery ? "No shares match your search" : "No shares found"}
						</h2>
						<p className="text-sm text-muted-foreground max-w-sm mt-1">
							{effectiveQuery
								? "Try a different search term or check the spelling."
								: "There are no discoverable shares yet. Share something to get started."}
						</p>
					</div>
				)}

				{!isPending && !isError && shares.length > 0 && (
					<>
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								{shares.length} share{shares.length !== 1 ? "s" : ""} found
								{effectiveQuery && <span> for &ldquo;{effectiveQuery}&rdquo;</span>}
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{shares.map((share) => (
								<ShareCard key={share.link_id} share={share} />
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
