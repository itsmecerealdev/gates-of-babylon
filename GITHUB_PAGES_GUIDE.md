# Deploying Gates of Babylon to GitHub Pages

The Gates of Babylon WebUI is configured to deploy directly to **GitHub Pages** with zero build steps, zero server dependencies, and zero configuration.

---

## How It Works
- The application runs 100% in the browser using the client-side logic engine matching `circuit.h`, `gate.h`, and `table.h`.
- `index.html` is placed at the repository root and references `./static/style.css` and `./static/app.js` using relative paths, ensuring it resolves correctly on `https://<username>.github.io/gates-of-babylon/`.
- If you run the Python C++ backend locally (`python server.py`), it automatically delegates to the compiled native C++ engine.

---

## Setup Steps (3 Clicks)

### 1. Push Changes to GitHub
Push your latest changes to your repository:
```bash
git add .
git commit -m "Deploy Gates of Babylon WebUI to GitHub Pages"
git push origin main
```

### 2. Enable GitHub Pages in Repository Settings
1. Open your repository on GitHub:
   `https://github.com/itsmecerealdev/gates-of-babylon`
2. Click the **Settings** tab in the top navigation bar.
3. In the left navigation menu under **Code and automation**, click **Pages**.
4. Under **Build and deployment**:
   - **Source:** Leave as `Deploy from a branch`
   - **Branch:** Select `main` (or `master`)
   - **Folder:** Select `/ (root)`
5. Click **Save**.

### 3. Access Your Live Site
Within 30–60 seconds, GitHub Actions will publish your site:
```
https://itsmecerealdev.github.io/gates-of-babylon/
```
*(GitHub will display your live URL at the top of the Pages settings page).*
