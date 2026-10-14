# Local architecture

```mermaid
flowchart LR
  Browser[Browser UI / Three.js WebGL] -->|GET page, assets, readiness| Server[Local Node HTTP server]
  Server --> UI[UI source or built dist]
  Browser --> Game[Shared game simulation]
  Converter[Offline Python converter] --> Assets[Converted MU models / textures / audio]
  Assets --> UI
  Tests[Node tests] --> Game
```

The local server is the entry point. The root `npm start` command builds the UI and launches the server. The UI owns rendering, user input and audio; the shared game package owns simulation. The server owns HTTP delivery and the small API surface. This keeps a future server-backed mode possible without coupling game rules to Three.js or the DOM.

There are no runtime network dependencies, authentication, persistence or database. Each new run creates a fresh in-memory state. Converted assets are ordinary JSON meshes, PNG textures, MP3 music and WAV effects. The build copies these plus vendored Three.js and shared game logic into a self-contained UI directory.
