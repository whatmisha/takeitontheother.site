# Pulsar Coder - Deployment Guide

## Local Development

### Quick Start
```bash
cd pulsar_coder
python3 -m http.server 8888
```

Open: **http://localhost:8888/index.html**

### Alternative Servers

**Node.js (http-server)**:
```bash
npx http-server -p 8888
```

**PHP**:
```bash
php -S localhost:8888
```

**Python 2**:
```bash
python -m SimpleHTTPServer 8888
```

---

## Production Deployment

### Static Hosting (Recommended)

#### Netlify
1. Drag & drop `pulsar_coder` folder to Netlify
2. Done! Auto-deployed with HTTPS

**Or via CLI**:
```bash
npm install -g netlify-cli
cd pulsar_coder
netlify deploy --prod
```

#### Vercel
```bash
npm install -g vercel
cd pulsar_coder
vercel --prod
```

#### GitHub Pages
1. Create repo: `pulsar-coder`
2. Push all files
3. Settings → Pages → Deploy from `main` branch
4. Access: `https://username.github.io/pulsar-coder/index.html`

---

## Directory Structure

```
pulsar_coder/
├── index.html      # Main app
├── pulsar-main.js         # Application logic
├── pulsar-styles.css      # Additional styles
│
├── css/
│   └── yf-styles.css      # YF Tools framework
│
├── js/
│   ├── ui/
│   │   ├── SliderController.js
│   │   ├── PanelManager.js
│   │   └── ZoomPanManager.js
│   └── utils/
│       ├── ColorUtils.js
│       ├── DOMUtils.js
│       └── MathUtils.js
│
├── fonts/                 # (optional, for extended UI)
│
├── PULSAR_README.md       # Full documentation
├── PULSAR_QUICKSTART.md   # Quick start
├── EXAMPLES.md            # Usage examples
├── PROJECT_SUMMARY.md     # Technical summary
└── DEPLOYMENT.md          # This file
```

**Required files for deployment**:
- `index.html`
- `pulsar-main.js`
- `pulsar-styles.css`
- `css/yf-styles.css`
- `js/ui/` (all files)
- `js/utils/` (all files)

**Optional**:
- `fonts/` (if using custom fonts)
- Documentation `.md` files

---

## Environment Requirements

### Browser Support
- **Minimum**: Chrome 60+, Firefox 60+, Safari 12+, Edge 79+
- **Optimal**: Latest versions of all browsers

### Features Required
- ES6 Modules
- TextEncoder/TextDecoder API
- Clipboard API (for Copy SVG)
- SVG support
- CSS Grid/Flexbox

---

## Configuration

### Base Path
If deploying to subdirectory, update paths in `index.html`:

**Before**:
```html
<link rel="stylesheet" href="css/yf-styles.css">
<script type="module" src="pulsar-main.js"></script>
```

**After** (e.g., in `/tools/pulsar/`):
```html
<link rel="stylesheet" href="/tools/pulsar/css/yf-styles.css">
<script type="module" src="/tools/pulsar/pulsar-main.js"></script>
```

### YF Tools Integration
To link back to YF Tools homepage:

```html
<a href="/js/YF/" class="yf-tools-link">←YF Tools</a>
```

Update `href` to match your deployment structure.

---

## Performance Optimization

### 1. Minification (Optional)

**CSS**:
```bash
npm install -g csso-cli
csso yf-styles.css -o yf-styles.min.css
csso pulsar-styles.css -o pulsar-styles.min.css
```

**JavaScript**:
```bash
npm install -g terser
terser pulsar-main.js -o pulsar-main.min.js -c -m
```

Update HTML to use `.min.css` and `.min.js` files.

### 2. Gzip Compression

Most static hosts auto-enable gzip. If self-hosting:

**Nginx**:
```nginx
gzip on;
gzip_types text/css application/javascript image/svg+xml;
```

**Apache** (`.htaccess`):
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/css application/javascript image/svg+xml
</IfModule>
```

### 3. Caching

**Nginx**:
```nginx
location ~* \.(css|js|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

**Netlify** (`netlify.toml`):
```toml
[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

---

## Security Headers

### Content Security Policy

For maximum security, add CSP header:

**Meta tag** (in HTML `<head>`):
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
```

**Or server header**:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

---

## Testing Checklist

Before deploying, test:

- [ ] ✅ HTML loads without errors
- [ ] ✅ All sliders functional
- [ ] ✅ Generate button creates pulsar map
- [ ] ✅ Verify button decodes correctly
- [ ] ✅ Download SVG works
- [ ] ✅ Copy SVG to clipboard works
- [ ] ✅ Presets apply correctly
- [ ] ✅ Zoom/pan on canvas works
- [ ] ✅ Panel collapse/expand works
- [ ] ✅ Mobile responsive (test on phone)
- [ ] ✅ All documentation links valid

---

## Monitoring

### Analytics (Optional)

Add Google Analytics or Plausible:

**Before `</body>`**:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Or Plausible** (privacy-friendly):
```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

---

## Troubleshooting

### Issue: "Module not found"
- **Cause**: ES6 modules require HTTP server
- **Fix**: Don't open via `file://`, use local server

### Issue: "CORS error"
- **Cause**: Local filesystem blocking module imports
- **Fix**: Run HTTP server or deploy to web

### Issue: SVG not displaying
- **Cause**: Missing `viewBox` or incorrect namespace
- **Fix**: Check SVG generation in `buildSvg()` function

### Issue: Verification fails
- **Cause**: Parameters changed between encode/verify
- **Fix**: Ensure ray count and ECC mode match

### Issue: Clipboard copy fails
- **Cause**: Browser requires HTTPS for Clipboard API
- **Fix**: Deploy to HTTPS host or use localhost

---

## Backup & Version Control

### Git Setup
```bash
cd pulsar_coder
git init
git add .
git commit -m "Initial commit: Pulsar Coder v1.0"
git remote add origin https://github.com/username/pulsar-coder.git
git push -u origin main
```

### .gitignore
```
.DS_Store
node_modules/
*.log
.env
```

---

## License & Attribution

If deploying publicly, consider adding:

**Footer in HTML**:
```html
<footer style="position: fixed; bottom: 10px; left: 10px; font-size: 0.8rem; color: #888;">
  Pulsar Coder v1.0 | Inspired by Voyager Golden Record (1977)
</footer>
```

---

## Support

For issues or questions:
- Check `PULSAR_README.md` for documentation
- Review `EXAMPLES.md` for usage patterns
- Test with `PULSAR_QUICKSTART.md` workflows

---

## Current Status

✅ **Production Ready**

**Live URL** (local): http://localhost:8888/index.html

**Deploy command**:
```bash
netlify deploy --prod
# or
vercel --prod
# or
git push origin main  # (if using GitHub Pages)
```

---

**Happy encoding! 🚀**






