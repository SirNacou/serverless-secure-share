"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

export type UploadStatus = "idle" | "uploading" | "success" | "error";
export type PayloadType = "file" | "text";

interface UploadProgressDialogProps {
	status: UploadStatus;
	payloadType: PayloadType;
	progress: number;
	onClose: () => void;
	errorMessage?: string;
	successDuration?: number;
}

export function UploadProgressDialog({
	status,
	payloadType,
	progress,
	onClose,
	errorMessage,
	successDuration = 2000,
}: UploadProgressDialogProps) {
	const isOpen = status !== "idle";

	// Internalize the success auto-close window mechanic
	useEffect(() => {
		if (status === "success") {
			const timer = setTimeout(() => {
				onClose();
			}, successDuration);

			return () => clearTimeout(timer);
		}
	}, [status, onClose, successDuration]);

	return (
		<Dialog
			open={isOpen}
			// Prevent manual backdrop dismissal during active network data transfers
			onOpenChange={(open) => {
				!open && status !== "uploading" && onClose();
			}}
		>
			<DialogContent className="sm:max-w-[280px] p-8 rounded-2xl border border-border bg-card text-card-foreground outline-none flex flex-col items-center justify-center min-h-[240px]">
				{/* ACTIVE PROCESSING STATE */}
				{status === "uploading" && (
					<div className="flex flex-col items-center justify-center space-y-4 w-full">
						{payloadType === "file" ? (
							<div className="flex flex-col items-center select-none animate-pulse">
								<span className="text-6xl font-black tracking-tighter text-primary">
									{progress}%
								</span>
								<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-2">
									Uploading File
								</span>
							</div>
						) : (
							<div className="flex flex-col items-center space-y-3 w-full">
								<div className="relative flex items-center justify-center h-16 w-16">
									<div className="absolute h-full w-full rounded-full bg-primary/10 animate-ping duration-1000" />
									<div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
										<div className="h-2 w-2 rounded-full bg-background animate-scale-up" />
									</div>
								</div>
								<span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground pt-1">
									Saving Text
								</span>
							</div>
						)}
					</div>
				)}

				{/* COMPLETION STATUS STATE */}
				{status === "success" && (
					<div className="flex flex-col items-center space-y-2 animate-in fade-in zoom-in-95 duration-150">
						<CheckCircle2 className="h-14 w-14 text-emerald-500 stroke-[1.2]" />
						<span className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mt-2">
							Share Ready
						</span>
					</div>
				)}

				{/* INTERRUPTED ERROR STATE */}
				{status === "error" && (
					<div className="flex flex-col items-center space-y-2 text-center animate-in fade-in zoom-in-95 duration-150 w-full">
						<AlertCircle className="h-14 w-14 text-destructive stroke-[1.2]" />
						<span className="text-[11px] font-bold uppercase tracking-widest text-destructive mt-2">
							Upload Failed
						</span>
						{errorMessage && (
							<p className="text-xs text-muted-foreground max-w-[200px] truncate pt-1">
								{errorMessage}
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
