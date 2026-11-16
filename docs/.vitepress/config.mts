import { defineNubiscoDocs } from '@nubisco/docs-sdk'

export default defineNubiscoDocs({
  title: 'OpenBridge Matter Platform',
  description: 'Read Matter devices from Apple Home in OpenBridge, locally, without adding them to HomeKit twice.',
  base: '/openbridge-matter-platform/',
  hostname: 'https://docs.nubisco.io/openbridge-matter-platform/',
  repo: 'nubisco/openbridge-matter-platform',
  nav: [
    { text: 'Using it', link: '/introduction' },
    { text: 'Contributing', link: '/contributing' },
    {
      text: 'Project',
      items: [
        { text: 'Repository', link: 'https://github.com/nubisco/openbridge-matter-platform' },
        {
          text: 'npm',
          link: 'https://www.npmjs.com/package/@nubisco/openbridge-matter-platform',
        },
        {
          text: 'Contributing',
          link: 'https://github.com/nubisco/openbridge-matter-platform/blob/master/CONTRIBUTING.md',
        },
        { text: 'Sponsor', link: 'https://github.com/sponsors/joseporto' },
      ],
    },
    {
      text: 'Nubisco',
      items: [
        { text: 'nubisco.io', link: 'https://nubisco.io' },
        { text: 'OpenBridge', link: 'https://github.com/nubisco/openbridge' },
        { text: 'Nubisco UI', link: 'https://docs.nubisco.io/ui/' },
        { text: 'Acta', link: 'https://docs.nubisco.io/acta/' },
      ],
    },
  ],
  sidebar: {
    '/contributing': [
      {
        text: 'Contributing',
        items: [{ text: 'How to contribute', link: '/contributing' }],
      },
      { text: 'Back to the guide', items: [{ text: 'Using the plugin', link: '/introduction' }] },
    ],
    '/': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Pairing a device', link: '/pairing' },
        ],
      },
      { text: 'Help', items: [{ text: 'Troubleshooting', link: '/troubleshooting' }] },
      { text: 'Working on the plugin', items: [{ text: 'Contributing', link: '/contributing' }] },
    ],
  },
  footer: {
    message:
      'Released under the <a href="https://github.com/nubisco/openbridge-matter-platform/blob/master/LICENSE">MIT License</a>. · <a href="https://github.com/sponsors/joseporto">♥ Sponsor this project</a>',
    copyright: 'Copyright © 2026 <a href="https://nubisco.io">Nubisco</a>',
  },
  vitepress: {
    // One address per page: /page, never also /page.html. Links, search and
    // the sitemap use the clean form, and the gateway 301s the .html one.
    cleanUrls: true,
    head: [
      [
        'meta',
        { name: 'keywords', content: 'openbridge, matter, thread, apple home, multi-admin, plugin, smart-home' },
      ],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'OpenBridge Matter Platform' }],
      [
        'meta',
        {
          property: 'og:description',
          content: 'Read Matter devices from Apple Home in OpenBridge, locally, without adding them to HomeKit twice.',
        },
      ],
    ],
  },
})
