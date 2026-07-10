"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertCircle, Check, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";

export type UploadStatus = "idle" | "uploading" | "success" | "error";
export type PayloadType = "file" | "text";

interface UploadProgressDialogProps {
	status: UploadStatus;
	payloadType: PayloadType;
	progress: number;
	shareId?: string;
	shareUrl?: string;
	onClose: () => void;
	errorMessage?: string;
}

export function UploadProgressDialog({
	status,
	payloadType,
	progress,
	shareId,
	shareUrl,
	onClose,
	errorMessage,
}: UploadProgressDialogProps) {
	const isOpen = status !== "idle";
	const [copied, setCopied] = useState(false);
	const [copiedShareId, setCopiedShareId] = useState(false);

	const handleCopy = async () => {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleCopyShareId = async () => {
		if (!shareId) return;
		await navigator.clipboard.writeText(shareId);
		setCopiedShareId(true);
		setTimeout(() => setCopiedShareId(false), 2000);
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				!open && status !== "uploading" && onClose();
			}}
		>
			<DialogContent
				className="sm:max-w-md p-6 rounded-2xl border border-border bg-card text-card-foreground outline-none flex flex-col items-center justify-center min-h-[240px]"
				showCloseButton={status !== "uploading"}
			>
				{/* ACTIVE PROCESSING STATE */}
				{status === "uploading" && (
					<div className="flex flex-col items-center justify-center space-y-5 w-full py-4">
						{payloadType === "file" ? (
							<>
								<div className="relative inline-flex items-center justify-center">
									<svg width={120} height={120} className="-rotate-90">
										<title>progress</title>
										<circle
											cx={60}
											cy={60}
											r={50}
											fill="none"
											stroke="currentColor"
											strokeWidth={8}
											className="text-muted/15"
										/>
										<circle
											cx={60}
											cy={60}
											r={50}
											fill="none"
											stroke="currentColor"
											strokeWidth={8}
											strokeLinecap="round"
											strokeDasharray={314.159}
											strokeDashoffset={314.159 - (progress / 100) * 314.159}
											className="text-primary transition-all duration-300 ease-out"
										/>
									</svg>
									<span className="absolute text-2xl font-bold tabular-nums select-none">
										{progress}%
									</span>
								</div>
								<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
									Uploading File
								</span>
							</>
						) : (
							<div className="flex flex-col items-center space-y-5 w-full">
								<div className="relative inline-flex items-center justify-center">
									<svg
										width={120}
										height={120}
										className="animate-spin"
										style={{ animationDuration: "1.5s" }}
									>
										<title>progress</title>
										<circle
											cx={60}
											cy={60}
											r={50}
											fill="none"
											stroke="currentColor"
											strokeWidth={8}
											className="text-muted/15"
										/>
										<circle
											cx={60}
											cy={60}
											r={50}
											fill="none"
											stroke="currentColor"
											strokeWidth={8}
											strokeLinecap="round"
											strokeDasharray={120}
											strokeDashoffset={0}
											className="text-primary"
										/>
									</svg>
								</div>
								<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
									Saving Text
								</span>
							</div>
						)}
					</div>
				)}

				{/* COMPLETION SUCCESS STATE (With Copy Action) */}
				{status === "success" && (
					<div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-150 w-full text-center">
						<CheckCircle2 className="h-12 w-12 text-emerald-500 stroke-[1.2]" />
						<span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">
							Share Ready
						</span>

						<div className="w-full space-y-3 pt-2">
							{shareUrl && (
								<div className="space-y-1">
									<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left block">
										Share Link
									</span>
									<div className="flex items-center gap-1.5 bg-muted/40 p-1.5 pl-3 rounded-lg border border-border/60 text-xs text-muted-foreground font-mono select-all truncate">
										<span className="truncate flex-1 text-left">{shareUrl}</span>
										<Button
											size="icon"
											variant="ghost"
											className="h-7 w-7 shrink-0"
											onClick={handleCopy}
										>
											{copied ? (
												<Check className="h-3.5 w-3.5 text-emerald-500" />
											) : (
												<Copy className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
								</div>
							)}
							{shareId && (
								<div className="space-y-1">
									<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left block">
										Share ID
									</span>
									<div className="flex items-center gap-1.5 bg-muted/40 p-1.5 pl-3 rounded-lg border border-border/60 text-xs text-muted-foreground font-mono select-all truncate">
										<span className="truncate flex-1 text-left">{shareId}</span>
										<Button
											size="icon"
											variant="ghost"
											className="h-7 w-7 shrink-0"
											onClick={handleCopyShareId}
										>
											{copiedShareId ? (
												<Check className="h-3.5 w-3.5 text-emerald-500" />
											) : (
												<Copy className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
								</div>
							)}
						</div>

						<Button
							variant="secondary"
							className="w-full text-xs h-9 mt-2"
							onClick={onClose}
						>
							Done
						</Button>
					</div>
				)}

				{/* ERROR STATE */}
				{status === "error" && (
					<div className="flex flex-col items-center space-y-2 text-center animate-in fade-in zoom-in-95 duration-150 w-full">
						<AlertCircle className="h-12 w-12 text-destructive stroke-[1.2]" />
						<span className="text-[11px] font-bold uppercase tracking-widest text-destructive mt-2">
							Upload Failed
						</span>
						{errorMessage && (
							<p className="text-xs text-muted-foreground max-w-[200px] truncate pt-1">
								{errorMessage}
							</p>
						)}
						<Button
							variant="outline"
							className="w-full text-xs h-9 mt-4"
							onClick={onClose}
						>
							Close
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
