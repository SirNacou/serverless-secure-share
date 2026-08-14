import { fetchAuthSession } from "aws-amplify/auth";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/auth/callback")({
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const attemptedRef = useRef(0);

	useEffect(() => {
		let cancelled = false;

		async function tryAuth() {
			try {
				const session = await fetchAuthSession();
				if (session.tokens?.accessToken) {
					router.navigate({ to: "/share", replace: true });
					return;
				}
			} catch {
				// not ready yet
			}

			if (cancelled) return;

			attemptedRef.current += 1;
			if (attemptedRef.current < 10) {
				setTimeout(tryAuth, 500);
			} else {
				router.navigate({ to: "/login", replace: true, search: { redirectTo: undefined } });
			}
		}

		tryAuth();
		return () => { cancelled = true; };
	}, [router]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
		</div>
	);
}
