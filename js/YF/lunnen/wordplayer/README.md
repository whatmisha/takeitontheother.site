# Wordplayer

Wordplayer is a self-contained static ES-module application. Its UI foundation,
runtime modules, fonts and assets all live inside this directory. It does not
depend on `/js/othersite-ui-framework/v3` or another project directory.

For local development, serve the Wordplayer directory itself:

```sh
cd /path/to/takeitontheother.site/js/YF/lunnen/wordplayer
python3 -m http.server 8000
```

Then open:

`http://localhost:8000/`
