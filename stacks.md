# dibujotecnico

## Stack

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| [Vite](https://vite.dev) | ^7 | Bundler / dev server |
| [React](https://react.dev) | ^19 | UI framework |
| [TypeScript](https://www.typescriptlang.org) | ~5.7 | Lenguaje tipado |
| [Konva](https://konvajs.org) | ^9 | Canvas 2D engine (imperative) |
| [react-konva](https://konvajs.org/docs/react/) | ^19 | Bindings React ↔ Konva |
| [Tailwind CSS](https://tailwindcss.com) | ^4 | Estilos utilitarios |
| [zustand](https://github.com/pmndrs/zustand) | ^5 | Estado global liviano |

## Estructura

```
src/
├── main.tsx            # Entry point
├── App.tsx             # Layout principal
├── index.css           # Import Tailwind
├── store/
│   └── useCanvasStore  # Estado global (zoom, pan)
└── components/
    └── GridCanvas      # Lienzo con grid milimetrado
```

## Comandos

```bash
npm run dev    # Desarrollo con HMR
npm run build  # Build producción
npm run preview # Preview build
```
