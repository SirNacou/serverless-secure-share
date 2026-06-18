import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/history')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_protected/history"!</div>
}
