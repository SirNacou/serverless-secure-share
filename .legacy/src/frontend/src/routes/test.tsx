import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test')({
  component: RouteComponent,
})

function RouteComponent() {
  throw new Error('Test error for /test route') // This will trigger the error component
  return <div>Hello "/test"!</div>
}
