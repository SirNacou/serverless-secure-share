import { Button } from "#/components/ui/button";
import { api } from "#/lib/api";
import type { ApiErrorResponse } from "#/types/api";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Check,
	Copy,
	Download,
	FileText,
	Lock,
	ShieldAlert,
	TimerOff,
} from "lucide-react";
import { useState } from "react";

interface ShareDownloadResponse {
	link_id: string;
	share_name: string;
	asset_type: "FILE" | "TEXT";
	payload_text?: string;
	filename?: string;
	downloadUrl?: string;
	visibility: "public" | "private";
}

interface ErrorPageConfig {
	title: string;
	icon: typeof ShieldAlert;
	description: string;
}

function getErrorConfig(errorMessage: string): ErrorPageConfig {
	if (errorMessage.includes("not found or expired") || errorMessage.includes("does not exist") || errorMessage.includes("Missing link")) {
		return {
			title: "Share Not Found",
			icon: ShieldAlert,
			description: "This link doesn't exist or has been removed.",
		};
	}
	if (errorMessage.includes("has expired")) {
		return {
			title: "Share Expired",
			icon: TimerOff,
			description: "The time window for this share has passed.",
		};
	}
	if (errorMessage.includes("download limit")) {
		return {
			title: "Download Limit Reached",
			icon: ShieldAlert,
			description: "This share has been downloaded the maximum allowed times.",
		};
	}
	if (errorMessage.includes("Access Denied") || errorMessage.includes("Unauthorized")) {
		return {
			title: "Access Denied",
			icon: Lock,
			description: "You don't have permission to view this private share.",
		};
	}
	if (errorMessage.includes("File state") || errorMessage.includes("unconfirmed")) {
		return {
			title: "File Not Ready",
			icon: ShieldAlert,
			description: "The file hasn't finished uploading yet. Please try again shortly.",
		};
	}
	return {
		title: "Resource Unavailable",
		icon: ShieldAlert,
		description: errorMessage || "Something went wrong loading this share.",
	};
}

const getShareQueryOptions = (shareId: string) =>
	queryOptions({
		queryKey: ["share", shareId],
		queryFn: async () => {
			const res = await api
				.get(`api/share/${shareId}`)
				.json<ShareDownloadResponse | ApiErrorResponse>();

			if ("error" in res) {
				throw new Error(res.error);
			}

			return res;
		},
		retry: 0,
	});

export const Route = createFileRoute("/s/$shareId")({
	loader: async ({ context: { queryClient }, params: { shareId } }) => {
		try {
			return await queryClient.ensureQueryData(getShareQueryOptions(shareId));
		} catch {
			return null;
		}
	},
	component: ShareViewComponent,
});

function ShareViewComponent() {
	const { shareId } = Route.useParams();
	const loaderData = Route.useLoaderData();
	const [copied, setCopied] = useState(false);

	const isFile = loaderData?.asset_type === "FILE";
	const { isPending, isError, error, data } = useQuery({
		...getShareQueryOptions(shareId),
		staleTime: isFile ? 4 * 60 * 1000 : Infinity,
		refetchOnMount: isFile,
		refetchOnWindowFocus: isFile,
		refetchOnReconnect: isFile,
	});

	if (isPending) {
		return (
			<div className="min-h-[80vh] flex items-center justify-center">
				<div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
			</div>
		);
	}

	if (isError) {
		const errMsg = error instanceof Error ? error.message : "Something went wrong";
		const config = getErrorConfig(errMsg);
		const Icon = config.icon;

		return (
			<div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
				<Icon className="h-16 w-16 text-destructive stroke-[1.2] mb-4" />
				<h1 className="text-xl font-bold tracking-tight">{config.title}</h1>
				<p className="text-sm text-muted-foreground max-w-sm mt-1">{config.description}</p>
			</div>
		);
	}

	const handleCopyText = async () => {
		if (!data.payload_text) return;
		await navigator.clipboard.writeText(data.payload_text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<header className="flex items-center justify-between px-6 py-3 border-b border-border">
				<Link
					to="/"
					className="text-sm font-bold tracking-tight text-foreground hover:text-primary transition-colors"
				>
					Secure Share
				</Link>
			</header>
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
					<div className="border-b border-border/60 pb-4 flex items-start justify-between gap-4">
						<h1 className="text-2xl font-black tracking-tight">
							{data.share_name}
						</h1>
						<span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
							{data.asset_type}
						</span>
					</div>

					{data.asset_type === "TEXT" && data.payload_text && (
						<div className="space-y-3">
							<div className="relative rounded-xl border border-border bg-muted/30 overflow-hidden font-mono text-sm">
								<div className="flex justify-between items-center px-4 py-2 bg-muted/80 border-b border-border text-xs text-muted-foreground">
									<span>Payload Content Snippet</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 gap-1.5 px-2.5 text-xs"
										onClick={handleCopyText}
									>
										{copied ? (
											<Check className="h-3.5 w-3.5 text-emerald-500" />
										) : (
											<Copy className="h-3.5 w-3.5" />
										)}
										{copied ? "Copied" : "Copy"}
									</Button>
								</div>
								<pre className="p-4 overflow-x-auto whitespace-pre-wrap max-h-[400px] leading-relaxed text-card-foreground select-text selection:bg-primary/20">
									{data.payload_text}
								</pre>
							</div>
						</div>
					)}

					{data.asset_type === "FILE" && (
						<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-8 bg-muted/10 space-y-4">
							<div className="h-14 w-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center">
								<FileText className="h-7 w-7 text-primary stroke-[1.5]" />
							</div>
							<div className="text-center space-y-1">
								<p className="text-sm font-semibold truncate max-w-xs md:max-w-md">
									{data.filename || "shared-asset.bin"}
								</p>
								<p className="text-xs text-muted-foreground">
									S3 secure binary allocation link ready.
								</p>
							</div>

							{data.downloadUrl ? (
								<Button asChild className="h-10 px-6 font-medium gap-2 mt-2">
									<a href={data.downloadUrl} download={data.filename}>
										<Download className="h-4 w-4" />
										Download Resource
									</a>
								</Button>
							) : (
								<p className="text-xs text-destructive font-medium">
									Access validation failed or down-stream link broken.
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
