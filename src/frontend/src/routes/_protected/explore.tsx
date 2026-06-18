import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/explore')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_protected/explore"!</div>
}
