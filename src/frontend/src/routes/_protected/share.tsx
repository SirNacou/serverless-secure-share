import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "#/components/kibo-ui/dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_protected/share")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="h-full grid grid-cols-2 grid-rows-[1fr_auto] gap-0 border-b border-r border-border">
			{/* Left Item (Desktop) / Top Item (Mobile) */}
			<div className="col-span-2 md:col-span-1 border-t border-l border-border p-4">
				<Input />
			</div>

			{/* Right Item (Desktop) / Middle Item (Mobile) */}
			<div className="col-span-2 md:col-span-1 border-t border-l border-border p-4">
				Right
			</div>

			{/* Bottom Item */}
			<div className="col-span-2 border-t border-l border-border p-4">
				Bottom
			</div>
		</div>
	);
}

function Input() {
	const [files, setFiles] = useState<File[]>([]);

	return (
		<Tabs className="h-full" defaultValue="file">
			<TabsList
				className="w-full text-xl font-bold gap-0 rounded-none border-b p-0"
				variant={"line"}
			>
				<TabsTrigger
					className="data-active:border-primary! -mb-px rounded-none border! group-data-horizontal/tabs:after:bottom-[-0.5px]"
					value="file"
				>
					File
				</TabsTrigger>
				<TabsTrigger
					className="data-active:border-primary! -mb-px rounded-none border! group-data-horizontal/tabs:after:bottom-[-0.5px]"
					value="text"
				>
					Text
				</TabsTrigger>
			</TabsList>
			<TabsContent value="file">
				<Dropzone
					className="h-full"
					maxFiles={1}
					maxSize={100 * 1024 * 1024}
					onError={console.error}
					src={files}
					onDrop={setFiles}
				>
					<DropzoneEmptyState />
					<DropzoneContent />
				</Dropzone>
			</TabsContent>
			<TabsContent value="text">
				<Textarea
					className="w-full h-full flex-1 min-h-[300px] resize-none bg-transparent p-4 outline-none text-sm placeholder:text-muted-foreground"
					placeholder="Enter your text here..."
				/>
			</TabsContent>
		</Tabs>
	);
}
