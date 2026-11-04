# Publicar un cambio en matichoc.cl

El sitio se publica solo con **GitHub Pages** cada vez que algo entra a la rama `main` del repositorio
https://github.com/Matichoc/matiweb. Por eso **nunca se trabaja directo en `main`**: todo pasa por una rama y un
Pull Request (PR), y se fusiona solo con la aprobación del dueño.

## 1. Preparar

```bash
git switch main
```

```bash
git pull --ff-only
```

```bash
git switch -c nombre-corto-del-cambio
```

Si Git reclama "dubious ownership" (la carpeta pertenece a otro usuario de Windows), agrega `-c safe.directory=*`
al comando, por ejemplo `git -c safe.directory=* status`.

## 2. Cambiar y probar

- Haz el cambio (ver [COMO-ACTUALIZAR.md](COMO-ACTUALIZAR.md)).
- Sirve el sitio con `python -m http.server 8123` y revisa en http://localhost:8123 a ~375 px y en escritorio:
  sin errores en la consola y sin desborde horizontal.
- Actualiza el `lastmod` en `sitemap.xml` si tocaste una página pública.

## 3. Guardar (commit)

Mensaje en español. Primera línea: qué cambió. Después: el detalle y **cómo revertirlo**.

```bash
git add archivos/que/cambiaste
```

```bash
git commit -m "Tienda: precio nuevo del alfajor" -m "Sube el alfajor de 1000 a 1200 en js/catalogo.js." -m "Para revertir: git revert este commit."
```

La cuenta de GitHub tiene la privacidad del correo activada. Si `git push` rechaza el commit por el correo, usa el
correo `noreply` de GitHub en la configuración de Git y vuelve a hacer el commit.

## 4. Subir y abrir el PR

```bash
git push -u origin nombre-corto-del-cambio
```

```bash
gh pr create --repo Matichoc/matiweb --base main --title "Tienda: precio nuevo del alfajor" --body "Qué cambia, cómo se probó y cómo revertir."
```

También se puede abrir desde la web de GitHub con el botón "Compare & pull request".

## 5. Publicar (solo con aprobación del dueño)

```bash
gh pr merge --repo Matichoc/matiweb --merge nombre-corto-del-cambio
```

GitHub Pages construye el sitio en 1 a 3 minutos. Para ver el estado:

```bash
gh api repos/Matichoc/matiweb/pages/builds/latest --jq ".status"
```

Cuando diga `built`, el cambio está en línea.

## 6. Verificar en vivo

- Abre https://matichoc.cl en el celular y en el computador. Recarga forzada (Ctrl+F5) si ves lo antiguo.
- Las fotos que se reemplazan con el mismo nombre pueden tardar unos minutos en verse nuevas (caché del navegador
  y de GitHub, ~10 minutos).
- Vuelve a `main` en tu carpeta local:

```bash
git switch main
```

```bash
git pull --ff-only
```

## 7. Deshacer un cambio publicado

En GitHub, abre el PR fusionado y usa el botón **Revert**. Se crea un PR nuevo que deshace todo; se fusiona igual
que cualquier otro. Por línea de comandos, desde una rama nueva:

```bash
git revert -m 1 <hash-del-merge>
```

## 8. Qué NO hacer sin el dueño

- Subir directo a `main` o fusionar sin aprobación.
- Cambiar DNS (Cloudflare), el dominio (`CNAME`) o la configuración de GitHub Pages.
- Cambiar el proceso de pago (Tuu/WhatsApp), precios o datos legales.
- Subir claves privadas (Supabase `service_role`, token de Telegram, contraseñas).

## 9. Matijuego

`matijuego/` no se edita aquí. Se cambia en el repositorio `Matichoc/MAtigame_v0` y desde ahí se despliega con
`MATIJUEGO_DEMO=1 node scripts/deploy-matiweb.mjs <ruta-a-matiweb>`. Eso actualiza los archivos de esta carpeta, que
después se publican con este mismo flujo (rama → PR → fusionar).
