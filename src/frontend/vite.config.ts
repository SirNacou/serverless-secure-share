import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    Icons({
      autoInstall: true,
      compiler: 'jsx',
      jsx: 'react',
    })
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react[\\/]|react-dom)/, priority: 30 },
            { name: 'vendor-router', test: /node_modules[\\/]@tanstack[\\/]react-router/, priority: 20 },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]react-query/, priority: 20 },
            { name: 'vendor-form', test: /node_modules[\\/]@tanstack[\\/]react-form/, priority: 20 },
            { name: 'vendor-amplify', test: /node_modules[\\/](aws-amplify|@aws-amplify)/, priority: 20 },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react/, priority: 20 },
            { name: 'vendor-ui', test: /node_modules[\\/]@radix-ui/, priority: 20 },
            { name: 'vendor-dropzone', test: /node_modules[\\/]react-dropzone/, priority: 20 },
            { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
  },
})

export default config
