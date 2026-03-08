import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        berkeley: {
          blue: '#003262',
          gold: '#FDB515',
          darkblue: '#002147',
          lightgold: '#FFD662',
        },
      },
    },
  },
  plugins: [],
}
export default config
