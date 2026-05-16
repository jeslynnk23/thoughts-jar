# thoughts jar

a tiny home for wandering thoughts.

## development

```bash
npm install
npm run dev
```

## build

```bash
npm run build
npm run preview
```

## deploy to vercel

1. push this folder to a github repository
2. go to [vercel.com](https://vercel.com) → new project
3. import the github repository
4. vercel will auto-detect vite — no extra config needed
5. deploy

the `vercel.json` in this repo handles SPA routing automatically.

## project structure

```
thought-jar/
├── index.html              # entry point + pwa meta tags
├── vite.config.js          # vite + pwa plugin config
├── package.json
├── vercel.json             # vercel spa routing
├── .gitignore
├── public/
│   ├── MyFreehandFont5.otf # handwritten font
│   ├── favicon.ico
│   ├── manifest.json       # static pwa manifest fallback
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-180.png    # apple touch icon
│       ├── icon-192.png    # pwa icon
│       └── icon-512.png    # pwa icon large
└── src/
    ├── main.jsx            # react entry point
    ├── index.css           # global styles + font-face
    └── App.jsx             # full app (all components)
```
