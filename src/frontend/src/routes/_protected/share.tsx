import { LifespanSelect, lifespanOptions } from "#/components/lifespan-select";
import { ShareContentForm } from "#/components/share-content-form";
import { Button } from "#/components/ui/button";
import {
	UploadProgressDialog,
	type UploadStatus,
} from "#/components/upload-progress-dialog";
import { UserMultiSelect } from "#/components/user-multi-select";
import { VisibilitySelector } from "#/components/visibility-selector";
import { api } from "#/lib/api";
import type { ShareUploadResponse } from "#/types/api";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

export const Route = createFileRoute("/_protected/share")({
	component: RouteComponent,
});

const shareFormSchema = z
	.object({
		payloadType: z.enum(["file", "text"]),
		files: z.array(z.instanceof(File)),
		textContent: z.string(),
		visibility: z.enum(["private", "public"]),
		selectedUsers: z.array(z.string()),
		lifespan: z.string(),
	})
	.superRefine((data, ctx) => {
		if (data.payloadType === "file" && data.files.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Please select or drop a file to share.",
				path: ["files"], // Highlights the file field
			});
		}
		if (data.payloadType === "text" && !data.textContent.trim()) {
			ctx.addIssue({
				code: "custom",
				message: "Please enter a text snippet to share.",
				path: ["textContent"], // Highlights the text field
			});
		}
	});

type ShareFormValues = z.infer<typeof shareFormSchema>;

const defaultValues: ShareFormValues = {
	payloadType: "file",
	files: [],
	textContent: "",
	visibility: "private",
	selectedUsers: [],
	lifespan: lifespanOptions[1].value,
};

function RouteComponent() {
	const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [apiError, setApiError] = useState<string>("");

	const form = useForm({
		defaultValues,
		validators: {
			onChange: shareFormSchema,
			onSubmit: shareFormSchema,
		},
		onSubmit: async ({ value }) => {
			// 2. Set structural states before initializing network calls
			setUploadStatus("uploading");
			setUploadProgress(0);
			setApiError("");

			try {
				// Metadata Registration step
				const data = await api
					.post("api/upload", {
						json: {
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
						},
					})
					.json<ShareUploadResponse>();

				// S3 Stream step
				if (value.payloadType === "file" && data.uploadUrl) {
					const targetFile = value.files[0];

					await api.put(data.uploadUrl, {
						body: targetFile,
						headers: { "Content-Type": targetFile.type },
						onUploadProgress: (progress) => {
							// Sync progress straight to the modal state hook
							setUploadProgress(Math.round(progress.percent * 100));
						},
					});
				} else {
					setUploadProgress(100);
				}

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
			{/* Left Column: Input Fields (Controlled via Form Fields) */}
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
											/* FIX: Use local state variable wrapper instead of tracking form engine natively */
											disabled={uploadStatus === "uploading"}
										/>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			</div>
			{/* Right Column: Configuration Access Rules */}
			<div className="col-span-2 md:col-span-1 border-t border-l border-border p-4 space-y-4 bg-muted/10">
				<form.Field name="visibility">
					{(field) => (
						<VisibilitySelector
							value={field.state.value}
							onChange={(val) => field.handleChange(val)}
						/>
					)}
				</form.Field>

				{/* Conditional Sub-field tracking using active form state */}
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
			</div>
			{/* Bottom Execution Bar */}
			<div className="col-span-2 border-t border-l border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-background">
				<form.Subscribe selector={(state) => [state.errorMap]}>
					{([errorMap]) => {
						// 1. Access the active lifecycle event error bucket
						const changeErrors = errorMap.onChange;
						let errorMessage = "";

						if (changeErrors) {
							if (typeof changeErrors === "string") {
								errorMessage = changeErrors;
							} else if (Array.isArray(changeErrors)) {
								// If it resolves as an array of issue objects or raw strings
								errorMessage = String(changeErrors[0]);
							} else if (typeof changeErrors === "object") {
								// For Zod Standard Schema V1 objects, grab the first nested property string value
								const firstNestedError = Object.values(changeErrors)[0];
								errorMessage = Array.isArray(firstNestedError)
									? String(firstNestedError[0]?.message || firstNestedError[0])
									: String(firstNestedError);
							}
						}

						return (
							<p className="text-sm text-destructive font-medium min-h-5 w-full text-left sm:w-auto">
								{errorMessage && errorMessage !== "undefined"
									? errorMessage
									: ""}
							</p>
						);
					}}
				</form.Subscribe>

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							type="submit"
							disabled={!canSubmit || isSubmitting}
							className="cursor-pointer w-full sm:w-fit px-8 h-11"
						>
							{isSubmitting ? "Processing..." : "Share"}
						</Button>
					)}
				</form.Subscribe>
			</div>
			<UploadProgressDialog
				status={uploadStatus}
				progress={uploadProgress}
				errorMessage={apiError}
				payloadType={form.getFieldValue("payloadType")}
				onClose={() => setUploadStatus("idle")}
				successDuration={1000}
			/>
		</form>
	);
}
