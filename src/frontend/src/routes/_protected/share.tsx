import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/share")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="h-full grid grid-cols-2 grid-rows-[1fr_auto] gap-4">
			<div className="col-span-2 md:col-span-1">
				<Input />
			</div>
			<div className="col-span-2 md:col-span-1">Right</div>
			<div className="col-span-2">Bottom</div>
		</div>
	);
}

function Input() {
	return (
		<Tabs defaultValue="file">
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
			<TabsContent value="file">File</TabsContent>
			<TabsContent value="text">Text</TabsContent>
		</Tabs>
	);
}
