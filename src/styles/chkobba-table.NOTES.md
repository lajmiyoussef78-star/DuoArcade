# Table surface — integration notes for Cursor

## Files

- `chkobba-table.css` — the complete surface. Drop in as-is, don't rewrite.
- `table.html` — reference markup + a working demo. Read for structure only.

## Required DOM structure

```html
<div class="ck-table">
  <div class="ck-baize">
    <svg class="ck-corner tl" viewBox="0 0 24 24"><path d="…heart…"/></svg>
    <svg class="ck-corner tr" viewBox="0 0 24 24"><path d="…diamond…"/></svg>
    <svg class="ck-corner bl" viewBox="0 0 24 24"><path d="…club…"/></svg>
    <svg class="ck-corner br" viewBox="0 0 24 24"><path d="…spade…"/></svg>

    <div class="ck-slots"><!-- table cards --></div>
    <div class="ck-hand"><!-- player hand, exactly 3 --></div>
  </div>
  <svg class="ck-cup" viewBox="0 0 120 96"><!-- optional --></svg>
</div>
```

Copy the four corner `<path>` values and the cup SVG verbatim from
`table.html`. They are hand-tuned; regenerating them will produce
worse shapes.

## Cards

A `.ck-card` is a presentation-free box — correct aspect ratio, radius,
shadow. It takes any child:

```html
<div class="ck-card"><img src="cards/Chkobba_carreau_07.svg" alt="7 of dīnārī"></div>
```

Do not set width, height, border-radius or box-shadow on the card
contents. The container owns all of that.

## Constraints that matter

- `.ck-slots` is a **wrapping flexbox**, not a 2×2 grid. A chkobba table
  regularly holds more than four cards mid-round. Do not convert it to a
  fixed grid.
- `.ck-hand` deliberately sits **below** the baize edge via a negative
  `bottom`, so the fan rests on the wood. Do not "fix" this.
- The `:nth-child` rotations on `.ck-hand .ck-card` assume exactly three
  cards. If you render a variable hand, compute the angle in JS instead.
- Retheme only through the custom properties in `:root`. Do not hardcode
  new colours elsewhere in the file.

## Prompt to paste into Cursor

> I've added `chkobba-table.css` and `table.html`. Refactor my game's board
> to use this table surface.
>
> Use `chkobba-table.css` unchanged — import it, don't inline or rewrite it.
> Build the DOM to match the structure in `table.html`, copying the corner
> suit SVGs and the cup SVG verbatim.
>
> Map my existing state onto it: the table cards render into `.ck-slots`,
> the player's hand into `.ck-hand`, one `.ck-card` wrapper per card with
> my card artwork as the child. Keep my existing click handlers and game
> logic working — only the presentation layer changes.
>
> Don't add gradients, glows, or animation beyond what's already in the CSS.
> Don't change `.ck-slots` to a fixed grid; it has to grow past four cards.

## If you want better wood

The plank texture is procedural, so the grain repeats on a fixed rhythm and
has no knots. A seamless tile will look better than any hand-written
gradient. Drop one in and uncomment the override block in the CSS:

```css
.ck-table{
  background-image:url("textures/oak.jpg");
  background-size:640px;
}
```

CC0 sources: polyhaven.com/textures, ambientcg.com
