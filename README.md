# MathMaster

MathMaster is a browser-based multiplication practice app designed to help learners build speed, accuracy, and confidence with tables from 1 to 30. It focuses on mental math training with adaptive practice, timed challenges, and progress tracking.

This project uses plain HTML, CSS, and JavaScript only. No Python is used here.

## Features

- Practice multiplication tables from 1 to 30
- Custom range selection for focused study sessions
- Quick practice mode and daily challenge mode
- Speed arena for timed drills
- Mistake tracking and weak-table recommendations
- Squares and cubes training lab
- XP, streak, level, and accuracy statistics
- Responsive dark UI for desktop and mobile

## Project structure

- `index.html` — main app markup and styling
- `script.js` — app logic, practice flow, timers, and stats
- `favicons/` — browser icon assets and manifest
- `og-image.png` — preview image used for sharing

## How to run

### Option 1: Open directly in a browser

Open `index.html` in any modern browser.

### Option 2: Use a local static server (no Python)

If you prefer serving it from a local web server, run one of these from the project folder:

```bash
npx serve .
```

or:

```bash
npx http-server .
```

Then open the local URL shown by the tool in your browser.

## Notes

- This is a static frontend project.
- There is no backend or package installation required for basic use.
- If you do not have Node.js installed, simply open `index.html` directly in the browser.

## Customization

You can update the experience by editing:

- `index.html` for content, layout, and styling
- `script.js` for logic, challenge generation, and scoring behavior
- `favicons/` and `og-image.png` for branding and preview assets

## License

This project does not currently include a license file. If you plan to share or deploy it publicly, you may want to add an appropriate license.
