import { LifespanSelect, lifespanOptions } from "#/components/lifespan-select";
import {
	MaxDownloadsSelect,
	maxDownloadsOptions,
} from "#/components/max-downloads-select";
import { ShareContentForm } from "#/components/share-content-form";
import { Button } from "#/components/ui/button";
import {
	UploadProgressDialog,
	type UploadStatus,
} from "#/components/upload-progress-dialog";
import { UserMultiSelect } from "#/components/user-multi-select";
import { VisibilitySelector } from "#/components/visibility-selector";
import { api } from "#/lib/api";
import type { ApiErrorResponse, ShareUploadResponse } from "#/types/api";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

export const Route = createFileRoute("/_protected/share/create")({
	component: RouteComponent,
});

const shareFormSchema = z
	.object({
		name: z.string(),
		payloadType: z.enum(["file", "text"]),
		files: z.array(z.instanceof(File)),
		textContent: z.string(),
		visibility: z.enum(["private", "public"]),
		selectedUsers: z.array(z.string()),
		lifespan: z.string(),
		maxDownloads: z.string(),
		customId: z.string().refine(
			(val) => {
				if (!val) return true;
				if (val.length < 4 || val.length > 64) return false;
				if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,62}[a-zA-Z0-9]$/.test(val))
					return false;
				if (
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
						val,
					)
				)
					return false;
				return true;
			},
			{
				message:
					"4-64 chars, only letters, numbers, hyphens, underscores. No UUID patterns.",
			},
		),
	})
	.superRefine((data, ctx) => {
		if (data.payloadType === "file" && data.files.length < 1) {
			ctx.addIssue({
				code: "custom",
				message: "Please select or drop a file to share.",
				path: ["files"],
			});
		}
		if (data.payloadType === "text" && !data.textContent.trim()) {
			ctx.addIssue({
				code: "custom",
				message: "Please enter a text snippet to share.",
				path: ["textContent"],
			});
		}
	});

type ShareFormValues = z.infer<typeof shareFormSchema>;

const defaultValues: ShareFormValues = {
	name: "",
	payloadType: "file",
	files: [],
	textContent: "",
	visibility: "public",
	selectedUsers: [],
	lifespan: lifespanOptions[0].value,
	maxDownloads: maxDownloadsOptions[0].value,
	customId: "",
};

function RouteComponent() {
	const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [apiError, setApiError] = useState<string>("");
	const [generatedLink, setGeneratedLink] = useState<string>("");
	const [generatedShareId, setGeneratedShareId] = useState<string>("");
	const router = useRouter();

	const form = useForm({
		defaultValues,
		validators: {
			onChange: shareFormSchema,
			onSubmit: shareFormSchema,
		},
		onSubmit: async ({ value }) => {
			setUploadStatus("uploading");
			setUploadProgress(0);
			setApiError("");
			setGeneratedLink("");
			setGeneratedShareId("");

			try {
				// Metadata Registration step
				const data = await api
					.post("api/upload", {
						json: {
							name: value.name,
							payloadType: value.payloadType,
							filename:
								value.payloadType === "file" ? value.files[0]?.name : null,
							contentType:
								value.payloadType === "file" ? value.files[0]?.type : null,
							textContent:
								value.payloadType === "text" ? value.textContent : null,
							visibility: value.visibility,
							targetUsers:
								value.visibility === "private" ? value.selectedUsers : [],
							lifespanHours: value.lifespan,
							maxDownloads: value.maxDownloads,
							customId: value.customId.trim(),
						},
					})
					.json<ShareUploadResponse | ApiErrorResponse>();

				if ("error" in data) {
					toast.error(`Error uploading: ${data.error}`);
					setUploadStatus("idle");
					return;
				}

				// S2 Stream step
				const uploadUrl = data.uploadUrl;
				if (value.payloadType === "file" && uploadUrl) {
					const targetFile = value.files[0];

					setUploadProgress(0);

					await new Promise<void>((resolve, reject) => {
						const xhr = new XMLHttpRequest();

						xhr.upload.onprogress = (event) => {
							if (event.lengthComputable) {
								const pct = Math.round((event.loaded / event.total) * 100);
								setUploadProgress(Math.min(100, Math.max(0, pct)));
							}
						};

						xhr.onload = () => {
							if (xhr.status >= 200 && xhr.status < 300) {
								resolve();
							} else {
								reject(new Error(`Upload failed (HTTP ${xhr.status})`));
							}
						};

						xhr.onerror = () =>
							reject(new Error("Upload failed (network error)"));
						xhr.onabort = () => reject(new Error("Upload aborted"));

						xhr.open("PUT", uploadUrl);
						xhr.setRequestHeader("Content-Type", targetFile.type);
						xhr.send(targetFile);
					});

					setUploadProgress(100);
				}

				const { pathname } = router.buildLocation({
					to: "/s/$shareId",
					params: { shareId: data.uploadId },
				});
				const publicShareUrl = `${window.location.origin}${pathname}`;
				setGeneratedLink(publicShareUrl);
				setGeneratedShareId(data.uploadId);
				setUploadStatus("success");
			} catch (error: unknown) {
				console.error(error);
				const errorMessage =
					error instanceof Error
						? error.message
						: typeof error === "string"
							? error
							: "Asset delivery rejected.";
				setApiError(errorMessage);
				setUploadStatus("error");
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="h-full grid grid-cols-2 grid-rows-[1fr_auto] gap-0 border-b border-r border-border"
		>
			{/* Left Column */}
			<div className="col-span-2 md:col-span-1 border-t border-l border-border p-4 flex flex-col min-h-[400px]">
				<form.Field name="payloadType">
					{(payloadTypeField) => (
						<form.Field name="files">
							{(filesField) => (
								<form.Field name="textContent">
									{(textField) => (
										<ShareContentForm
											payloadType={payloadTypeField.state.value}
											onTypeChange={(val) => payloadTypeField.handleChange(val)}
											files={filesField.state.value}
											onFilesChange={(val) => filesField.handleChange(val)}
											textContent={textField.state.value}
											onTextChange={(val) => textField.handleChange(val)}
											disabled={uploadStatus === "uploading"}
										/>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			</div>

			{/* Right Column */}
			<div className="col-span-2 md:col-span-1 border-t border-l border-border p-4 space-y-4 bg-muted/10">
				<form.Field name="name">
					{(field) => (
						<div className="bg-card border border-border rounded-xl p-4 space-y-2">
							<label
								htmlFor={field.name}
								className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Share Title / Name
							</label>
							<input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								disabled={uploadStatus === "uploading"}
								placeholder="e.g., My Share"
								className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="customId">
					{(field) => {
						const val = field.state.value;
						const errors = field.state.meta.errors;
						const errorMsg = errors?.[0]?.message;
						const isCustom = val.trim().length > 0;
						return (
							<div className="bg-card border border-border rounded-xl p-4 space-y-2">
								<label
									htmlFor={field.name}
									className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
								>
									Custom Link ID (optional)
								</label>
								<input
									id={field.name}
									name={field.name}
									value={val}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={uploadStatus === "uploading"}
									placeholder="e.g., my-project-alpha"
									className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
								/>
								{isCustom && errorMsg ? (
									<p className="text-[11px] text-destructive">{errorMsg}</p>
								) : isCustom ? (
									<p className="text-[11px] text-emerald-500">
										Custom ID looks good
									</p>
								) : (
									<p className="text-[11px] text-muted-foreground">
										Leave empty for auto-generated short ID
									</p>
								)}
							</div>
						);
					}}
				</form.Field>
				<form.Field name="visibility">
					{(field) => (
						<VisibilitySelector
							value={field.state.value}
							onChange={(val) => field.handleChange(val)}
						/>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.visibility}>
					{(visibilityValue) =>
						visibilityValue === "private" ? (
							<form.Field name="selectedUsers">
								{(field) => (
									<UserMultiSelect
										selected={field.state.value}
										onChange={(val) => field.handleChange(val)}
										availableUsers={[]}
									/>
								)}
							</form.Field>
						) : null
					}
				</form.Subscribe>

				<form.Field name="lifespan">
					{(field) => (
						<LifespanSelect
							value={field.state.value}
							onChange={(val) => field.handleChange(val)}
						/>
					)}
				</form.Field>

				<form.Field name="maxDownloads">
					{(field) => (
						<MaxDownloadsSelect
							value={field.state.value}
							onChange={(val) => field.handleChange(val)}
						/>
					)}
				</form.Field>
			</div>

			{/* Bottom Execution Bar */}
			<div className="col-span-2 border-t border-l border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-background">
				<form.Subscribe selector={(state) => [state.errorMap]}>
					{([errorMap]) => {
						// FIX: Fallback to onSubmit errors if onChange errors don't exist yet
						const changeErrors = errorMap.onChange || errorMap.onSubmit;
						let errorMessage = "";

						if (changeErrors) {
							if (typeof changeErrors === "string") {
								errorMessage = changeErrors;
							} else if (Array.isArray(changeErrors)) {
								errorMessage = String(changeErrors[0]);
							} else if (typeof changeErrors === "object") {
								const firstNestedError = Object.values(changeErrors)[0];
								errorMessage = Array.isArray(firstNestedError)
									? String(firstNestedError[0]?.message || firstNestedError[0])
									: String(firstNestedError);
							}
						}

						return (
							<p className="text-sm text-destructive font-medium min-h-6 w-full text-left sm:w-auto">
								{errorMessage && errorMessage !== "undefined"
									? errorMessage
									: ""}
							</p>
						);
					}}
				</form.Subscribe>

				{/* Submit Button Wrapper */}
				<Button
					type="button" // Change to button to prevent default raw HTML form submission behaviors
					disabled={uploadStatus === "uploading"}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit(); // Force TanStack execution manually
					}}
					className="cursor-pointer w-full sm:w-fit px-9 h-11"
				>
					{uploadStatus === "uploading" ? "Processing..." : "Share"}
				</Button>
			</div>

			<UploadProgressDialog
				status={uploadStatus}
				progress={uploadProgress}
				errorMessage={apiError}
				payloadType={form.getFieldValue("payloadType")}
				onClose={() => setUploadStatus("idle")}
				shareUrl={generatedLink}
				shareId={generatedShareId}
			/>
		</form>
	);
}
