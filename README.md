# Pixboard

Pixboard is a lightweight image editor that runs entirely in your browser. All processing is done locally so it's free and instant to use.

![Filter Demo](docs/filter-demo.png)

## Features

- Load any image from your device
- Rotate and flip
- Resize the canvas
- Adjust brightness
- Partial grayscale filter with saturation threshold
- Quick filter switching (Normal/Grayscale/Sepia/Partial Gray)
- Save the result as PNG or JPEG
- Mask mode for layer clipping
- Zoom in/out with mouse wheel or pinch
- Adjust brightness
- Advanced batch editing with integrated EdiBatPlus UI (no separate folder)
- Color picker shows exact RGB hex values
- Distortion tool with adjustable strength
- Multi-threaded image processing for faster edits

### Pixboard の強み

- ローカル処理でプライバシー安心
- 無料でインストール不要
- すぐに使えるシンプルなUI

## Coming Soon

- Cropping tool
- Undo / redo
## Running

Install Flask and start a local server:

```
pip install Flask
python app.py
```

On Windows, you can instead run the bundled `run_app.bat` script which installs Flask if needed and launches the server automatically.

Then open `http://localhost:5000` in your browser. The **Batch Process** button toggles the built-in EdiBatPlus batch editor, and a **Back to Pixboard** button returns to the single-image editor.
