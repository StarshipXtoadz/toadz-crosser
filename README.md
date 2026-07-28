# Toadz Crosser!

Help Toad hop across a multi-lane freeway. Free browser game.

- **Landing page:** `index.html`
- **Play:** `play.html`
- **Desktop Python version (optional):** `~/toadz_crosser.py`

---

## Play locally

```bash
cd ~/toadz-crosser
python3 -m http.server 8080
```

Open: [http://localhost:8080](http://localhost:8080)

---

## Publish free on GitHub Pages (X bio link)

### 1. Create a GitHub repo

1. Go to [https://github.com/new](https://github.com/new)
2. Name it e.g. `toadz-crosser` (public)
3. Don’t add a README if you’ll push this folder (or you can merge later)
4. Create repository

### 2. Push this project

In Terminal (replace `YOUR_USERNAME`):

```bash
cd ~/toadz-crosser
git init
git add .
git commit -m "Toadz Crosser! web game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/toadz-crosser.git
git push -u origin main
```

If GitHub asks you to sign in, use a [Personal Access Token](https://github.com/settings/tokens) or GitHub CLI (`gh auth login`).

### 3. Turn on GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` / folder `/ (root)`
4. Save

After 1–2 minutes your game is live at:

```text
https://YOUR_USERNAME.github.io/toadz-crosser/
```

Play page:

```text
https://YOUR_USERNAME.github.io/toadz-crosser/play.html
```

### 4. Put it on X

1. X → **Profile** → **Edit profile** → **Website**  
   → paste `https://YOUR_USERNAME.github.io/toadz-crosser/`
2. Pin a post, for example:

> 🐸 **Toadz Crosser!**  
> Hop across the freeway. Free in your browser.  
> https://YOUR_USERNAME.github.io/toadz-crosser/

---

## Custom domain (optional)

In repo **Settings → Pages → Custom domain**, add e.g. `toadz.yourdomain.com`, then add the DNS records GitHub shows.

---

## Controls

| Input | Action |
|--------|--------|
| Enter / Space / Tap | Start / next / menu |
| Arrows or WASD | Hop |
| On-screen pad | Hop (phones) |
| Esc | Title menu |

---

## License

Use and share freely for your X / portfolio. Have fun!
