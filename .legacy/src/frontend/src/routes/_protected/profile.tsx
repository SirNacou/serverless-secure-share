import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { api } from "#/lib/api";
import type { ProfileResponse } from "#/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_protected/profile")({
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const [displayName, setDisplayName] = useState("");

	const { data, isPending } = useQuery({
		queryKey: ["profile"],
		queryFn: () => api.get("api/profile").json<ProfileResponse>(),
	});

	useEffect(() => {
		if (data?.display_name) {
			setDisplayName(data.display_name);
		}
	}, [data]);

	const mutation = useMutation({
		mutationFn: (name: string) =>
			api.put("api/profile", { json: { display_name: name } }).json<ProfileResponse>(),
		onSuccess: (result) => {
			queryClient.setQueryData(["profile"], result);
			toast.success("Display name updated");
		},
		onError: (err: Error) => {
			toast.error(err.message || "Failed to update display name");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = displayName.trim();
		if (!trimmed) {
			toast.error("Display name cannot be empty");
			return;
		}
		if (trimmed.length > 50) {
			toast.error("Display name must be 50 characters or less");
			return;
		}
		mutation.mutate(trimmed);
	};

	return (
		<div className="max-w-lg mx-auto p-6 space-y-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold tracking-tight">Profile</h1>
				<p className="text-sm text-muted-foreground">
					Manage your display name shown on the explore page
				</p>
			</div>

			{isPending ? (
				<div className="space-y-4">
					<div className="h-4 bg-muted-foreground/10 rounded w-24 animate-pulse" />
					<div className="h-10 bg-muted-foreground/5 rounded animate-pulse" />
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Display Name
						</Label>
						<Input
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Enter your display name"
							maxLength={50}
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							This will appear next to your shares on the explore page
						</p>
					</div>

					<Button
						type="submit"
						className="w-full h-10"
						disabled={mutation.isPending || !displayName.trim()}
					>
						{mutation.isPending ? "Saving..." : "Save"}
					</Button>
				</form>
			)}

			{data && (
				<div className="text-xs text-muted-foreground border border-border rounded-lg p-3 space-y-1">
					<p>Username: <code className="font-mono text-foreground">{data.username}</code></p>
					{data.display_name && (
						<p>Display name: <span className="text-foreground">{data.display_name}</span></p>
					)}
				</div>
			)}
		</div>
	);
}
