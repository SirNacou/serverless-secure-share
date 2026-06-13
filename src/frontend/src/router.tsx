import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { Amplify } from 'aws-amplify'
import {
  getContext,
} from './integrations/tanstack-query/root-provider'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.REACT_APP_COGNITO_USER_POOL_CLIENT_ID!,
      identityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID!,
      loginWith: {
        username: true
      }
    }
  }
})

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
