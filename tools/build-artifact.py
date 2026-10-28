#!/usr/bin/env python3
"""Собирает игру из dist/ в один HTML-файл (для публикации страницей).

    npm run build && python3 tools/build-artifact.py OUT.html [--embed]

Код и стили встраиваются в страницу. Картинки (фон меню, фоны локаций, атласы
спрайтов) остаются отдельными файлами по тем же относительным путям — их
публикуют рядом со страницей. С --embed картинки встраиваются как data: URI.
"""
import base64, glob, os, re, sys

out = sys.argv[1]
embed = '--embed' in sys.argv
css = open(glob.glob('dist/assets/*.css')[0]).read()
js = open(glob.glob('dist/assets/*.js')[0]).read()

MIME = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4'}
total = 0
for path in sorted(set(re.findall(r'(?:art|backgrounds|sprites|portraits|video|icons)/[\w.-]+\.(?:webp|jpg|png|mp4)', js))):
    f = os.path.join('dist', path)
    if not os.path.exists(f):
        print('нет файла', f)
        continue
    data = open(f, 'rb').read()
    total += len(data)
    print('  ', path, len(data) // 1024, 'КБ')
    if not embed:
        continue
    js = js.replace(path, f'data:{MIME[os.path.splitext(f)[1]]};base64,' + base64.b64encode(data).decode())

html = f'''<title>Хамсин</title>
<meta name="description" content="Постъядерная изометрическая RPG в израильском сеттинге. Прототип.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
<div id="app"></div>
<script type="module">
{js}
</script>
'''
open(out, 'w').write(html)
print(f'{out}: {len(html) // 1024} КБ (картинки {total // 1024} КБ)')
