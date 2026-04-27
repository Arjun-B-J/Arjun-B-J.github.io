# Arjun-B-J.github.io

An interactive "Sunset" scene published as a GitHub Pages site at
[arjun-b-j.github.io](https://arjun-b-j.github.io). Click the sun to toggle the
sky between day and dusk: the gradient shifts, the sun drops, and the layered
mountain silhouettes swap colors.

Originally exported from a CodePen ([pen `BaNRJQZ`](https://codepen.io/arjun_b_j/pen/BaNRJQZ))
and served from this user-pages repo.

## Tech stack

- Plain HTML (`index.html`)
- CSS for the gradient sky and CSS-triangle mountains (`style.css`)
- A small vanilla JS click handler that mutates inline styles (`script.js`)

No build step, framework, or package manager.

## Run locally

Just open `index.html` in a browser, or serve the directory with anything
static, e.g.:

```
python -m http.server 8000
```

then visit http://localhost:8000.

## Deployment

GitHub Pages serves the repo root from the `master` branch — pushing to
`master` deploys the site at https://arjun-b-j.github.io.

## License

See `license.txt`.
