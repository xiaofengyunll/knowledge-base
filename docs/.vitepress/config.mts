import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
const base = '/knowledge-base/'

export default defineConfig({
  base,
  title: "xiaf的文档站",
  description: "从开发到工程化实践",
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: `${base}favicon.png` }],
    ['link', { rel: 'apple-touch-icon', href: `${base}favicon.png` }]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
    ],

    sidebar: [
      {
        text: 'docker',
        collapsed: true,
        items: [
          { text: '容器化技术', link: '/docker/容器化技术.md' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xiaofengyunll' }
    ]
  }
})
