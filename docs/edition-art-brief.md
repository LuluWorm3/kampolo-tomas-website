# Renaissance Edition: art brief for every chapter

Goal: every chapter gets a painting from the same world as the Studio picture (the gentleman in the rose velvet cloak, crimson curtain, old-master oil look), instead of the museum paintings now used as placeholders. One picture per chapter.

## What the site needs from every picture

- **Format:** landscape 16:10 (for example 2400 x 1500 or larger), JPEG or PNG. The site crops to 16:10 and resizes to 1600 x 1000.
- **Dark and calm at the top.** The huge chapter word and the italic lead sit across the top 40% of the picture, so keep that part quiet: curtain, sky, wall, shelves, soft detail, no faces. Put the subject and faces in the lower 60%.
- **Hero only:** the title sits on the left, so keep the left 60% quiet and put the subject on the right.
- **No text, logos, letters or numbers** anywhere in the picture (the site adds its own text).
- **Same character, same world:** the owner as the gentleman (use the reference photos), rose velvet cloak, cream linen blouse with the embroidered collar, crimson curtain, deep brown shadows, a patch of blue sky, fine craquelure.
- **One grade for both themes:** the site shows the scenes in the dark grade in light and dark mode (as the Studio does). Do not make a separate light version.

## Shared style prefix (paste before every scene prompt)

> Old-master oil painting, 16:10 landscape, chiaroscuro, rich crimson velvet curtain, warm deep shadows, visible brush strokes and fine craquelure. The man is the same young gentleman as in the reference photos (exact likeness, close-cropped hair with a clean tapered fade), wearing a rose velvet cloak over a cream linen blouse with an embroidered collar. No text, no logos, no letters anywhere. The top 40% of the picture is calm and low in detail.

## Per chapter

| File (save in `scripts/private/scenes/`) | Chapter | Scene to ask for | What the site will put on it |
|---|---|---|---|
| `interior.jpg` | Home (opening) | The gentleman in three-quarter view at a desk with an open book and a smartphone, seen in a dark cabinet-of-curiosities room; subject on the right 40%, left 60% quiet dark wall | Title and lead on the left; floating skill cards, the phone and the project deck drift over it |
| `about.jpg` | About | The gentleman reading by a tall window, books and a globe on the table, looking toward the viewer with a calm expression | Word and lead across the top |
| `experience.jpg` | Experience | A guild workshop with three workbenches in depth: a laptop-era bench with a CRT, an IT toolkit with cables and a router, and a ledger desk; the gentleman at the nearest bench | Word and lead across the top |
| `projects.jpg` | Projects | A long gallery wall with six empty gilded frames in perspective (blank canvases), the gentleman small in the foreground looking up at them | Six project titles can later be laid on the six frames, so keep them plain and well spaced |
| `skills.jpg` | Skills | A table with five instruments laid out in an even row (compass, astrolabe, quill, globe, clockwork device), the gentleman behind them | Five-step skill scale ties in with the five objects |
| `education.jpg` | Education | A library with tall shelves and many rolled scrolls with wax seals; the gentleman holds one scroll | Word and lead across the top |
| `contact.jpg` | Contact | The gentleman writing a letter by candlelight at a desk, a sealed letter and quill beside him, a window behind | Form sits below on the paper, so the picture only needs the top scene |
| `404.jpg` | 404 page ("CDIV") | A pale empty rectangle and a nail on a dark wall where a painting used to hang; the gentleman looks at it with his hands behind his back | The big Roman numeral CDIV in the centre; keep the middle calm |

Optional extra scenes for the three persona-only sections (only shown on the Data, Design and Shop views): a map and astrolabe table (data), a palette with colour swatches (style lab), a camera obscura (image lab).

## After you generate them

1. Save each image as `scripts/private/scenes/<name>.jpg` (the folder is gitignored, so originals stay private).
2. Tell me. The build step will read them instead of the museum paintings, grade them, set the focus point per chapter and update the credits page.
3. Check each generated face against your photos before sending.

## Notes

- The image generator's terms apply to commercial use. Check them before the site goes live.
- If one scene does not work, the museum painting stays in that chapter until a better picture arrives.
