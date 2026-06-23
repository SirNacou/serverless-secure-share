"use client";

import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "#/components/kibo-ui/dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";

export type PayloadType = "file" | "text";

interface ShareContentFormProps {
	payloadType: PayloadType;
	onTypeChange: (type: PayloadType) => void;
	files: File[];
	onFilesChange: (files: File[]) => void;
	textContent: string;
	onTextChange: (text: string) => void;
	disabled?: boolean;
}

export function ShareContentForm({
	payloadType,
	onTypeChange,
	files,
	onFilesChange,
	textContent,
	onTextChange,
	disabled,
}: ShareContentFormProps) {
	return (
		<Tabs
			className="h-full flex flex-col"
			value={payloadType}
			onValueChange={(val) => onTypeChange(val as PayloadType)}
		>
			<TabsList
				className="w-full justify-start text-xl font-bold gap-0 rounded-none border-b p-0 bg-transparent h-10"
				variant={"line"}
			>
				<TabsTrigger
					className="data-active:border-primary! -mb-px rounded-none border-b-2 border-transparent h-full px-4"
					value="file"
					disabled={disabled}
				>
					File
				</TabsTrigger>
				<TabsTrigger
					className="data-active:border-primary! -mb-px rounded-none border-b-2 border-transparent h-full px-4"
					value="text"
					disabled={disabled}
				>
					Text
				</TabsTrigger>
			</TabsList>

			<div className="flex-1 min-h-0 pt-4">
				<TabsContent
					value="file"
					className="h-full mt-0 focus-visible:outline-none"
				>
					<Dropzone
						className="h-full min-h-[300px]"
						maxFiles={1}
						maxSize={100 * 1024 * 1024}
						onError={console.error}
						src={files}
						onDrop={onFilesChange}
						disabled={disabled}
					>
						<DropzoneEmptyState />
						<DropzoneContent />
					</Dropzone>
				</TabsContent>

				<TabsContent
					value="text"
					className="h-full mt-0 focus-visible:outline-none"
				>
					<Textarea
						value={textContent}
						onChange={(e) => onTextChange(e.target.value)}
						disabled={disabled}
						className="w-full h-full min-h-[300px] resize-none bg-transparent p-4 outline-none border border-input rounded-xl focus-visible:ring-1 focus-visible:ring-ring"
						placeholder="Enter your plain text snippet context here..."
					/>
				</TabsContent>
			</div>
		</Tabs>
	);
}
