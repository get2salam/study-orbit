# Study Orbit

A local-first study planner for deep work blocks, revision cycles, and exam readiness.

![Study Orbit preview](docs/preview.svg)

Study Orbit is a small local-first planning tool for solo builders, operators, and creative teams who want a cleaner way to manage sessions. Add items, score the signal, track the friction, and keep the strongest opportunities visible without needing a backend or build step.

## Features

- Local-first persistence with `localStorage`
- Search and filter controls
- Ranked list sorted by signal minus friction
- Inline editor for title, notes, type, status, score, and effort
- Import/export JSON backups
- Re-seed action for resetting the sample board
- Keyboard shortcuts: `N` for new, `/` for search
- No build tooling, just open in a browser

## Quick start

```bash
git clone https://github.com/<you>/study-orbit.git
cd study-orbit
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Data shape

```json
{
  "boardTitle": "MS AI study orbit",
  "items": [
    {
      "title": "Reinforcement learning notes",
      "category": "Reading",
      "state": "Running",
      "score": 8,
      "effort": 4
    }
  ]
}
```

## Privacy

Everything stays in your browser unless you export a JSON backup.

## License

MIT
