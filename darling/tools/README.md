# tools

## lettering.py — логотип-надпись

Собирает надпись IDEA: контуры букв из Cormorant Garamond Bold + шипы, иглы,
дуга-росчерк, капля и звёзды, нарисованные кодом (кривые Безье, штрих переменной
ширины).

```bash
pip install fonttools
# TTF: Google Fonts CSS API отдаёт ссылку на .ttf, если User-Agent не браузерный
curl -s -A "Wget/1.21" "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700" \
  | grep -o 'https://[^)]*\.ttf' | head -1 | xargs curl -s -o cg700.ttf
python3 lettering.py cg700.ttf wordmark.svg
```

Результат — SVG с двумя `<path>`: буквы и украшения. На сайте оба пути лежат в
`<symbol id="wordmark">` в спрайте наверху `index.html`, с тем же `viewBox`, и
вставляются через `<use href="#wordmark"/>` в hero и в меню.

Для другого слова: поменять строку в цикле `for ch in 'IDEA'` и переставить координаты
украшений (`thorn`, `stroke` + `cbez`, `tear`, `star`) под новые формы. Правила:
- украшение растёт **из** буквы (из засечки, чаши, перекладины), а не висит рядом;
- штрих всегда переменной толщины, кончики волосяные;
- одна большая дуга через всё слово, остальное мелкое;
- звёзд 2–3, разного размера, не симметрично.

## prep_photos.py — подготовка фото

```bash
pip install pillow
python3 prep_photos.py gray      in.jpg  out.jpg            # ч/б + контраст 1.08
python3 prep_photos.py selective in.webp out.jpg            # серый, кроме малинового
python3 prep_photos.py poster    in.jpg  out.png --px 256   # 3 тона для ECB-демо
```

Для ECB-демо постер потом кладётся в JS как base64 (по байту на пиксель), см.
`assets/js/angel-data.js`: загружать картинку в канвас на file:// нельзя.

## shot.cjs, sections.cjs — скриншоты

Нужен Playwright с Chromium. Если `require('playwright')` его не находит — путь
в переменной `PLAYWRIGHT`.

```bash
node shot.cjs file://$PWD/index.html hero.png                       # 1440×900
node shot.cjs file://$PWD/index.html full.png 1440 900 1             # вся страница
node shot.cjs file://$PWD/index.html ru.png 1440 900 0 "I18N.set('ru')"
node sections.cjs file://$PWD/index.html shots/s genesis,operations,round
```

Скрипты печатают ошибки консоли и упавшие запросы — если что-то есть, это баг.
