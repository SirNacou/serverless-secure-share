import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/")({
	beforeLoad: async (ctx) => {
		throw redirect({
			to: "/share",
			replace: true,
		});
	},
});
