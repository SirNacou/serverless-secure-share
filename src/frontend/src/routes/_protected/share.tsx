import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/share")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="h-full grid grid-cols-2 grid-rows-[1fr_auto] gap-4">
			<div className="col-span-2 md:col-span-1">Left</div>
			<div className="col-span-2 md:col-span-1">Right</div>
			<div className="col-span-2">Bottom</div>
		</div>
	);
}
