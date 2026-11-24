# Hammer bonk (footer easter egg) - design, 2026-11-24

Ask (Perry): carry the hammer to the bottom of the screen, drop it on the head of the construction guy eating the
sandwich: it bonks him, a second or two later the crack in the street opens and people fall in.

Original slapstick, nothing from any film. Nobody is hurt: dust, stars, a comic climb-out, the street closes again.

## Where the code lives (and one honest deviation)
The brief says the brand generator is the source of truth for the footer SVG. It is not any more: `brand/mascot/footer`
on main regenerates a 392 KB scene, the site's `assets/footer-scene.svg` is 535 KB, and the egg ids (`o-sw`, `o-egg`,
`o-swart`) were edited into the site file by hand (`ce0c716`). Regenerating would change the sitter and pusher
animation for everyone. So the gag adds NO markup to the SVG file: `assets/footer-scene.js` draws its own overlay
group into the loaded SVG at play time and removes it at the end. The generator and the SVG file are untouched.

## Hit test
- `footer-scene.js` exposes `window.__bonk` once the SVG is mounted: `box()` returns the sitter's head box in PAGE
  coordinates (scene units -> screen via `getScreenCTM`, plus scroll), `play(release)` runs the gag, `at(t)` draws second t.
- Head box in scene units: x 497..541, y 108..142 (hat top to chin; the head sits near (519,129)).
- `builder.js` `ledges()`: while `__bonk` is ready and idle, the footer SVG is not a ledge (it would catch the hammer
  at the top of the scene, above his head). Instead one narrow ledge is the head box top. Everything else is unchanged:
  the floor, text lines, cards.
- In `tick()`: if the hammer's steel head is inside the head box (expanded 6 px) and it is moving down at >250 px/s
  the frame it meets the ledge, that is a bonk: `__bonk.play(release)`. A slow settle on his head does nothing.
- `release()` removes the head ledge, so the hammer then slides off and falls to the page floor (the street is the
  bottom of the page) while he drops in.

## Phone path
Dragging is in page coordinates and the page must not scroll under a touch on the hammer, so a long carry to the
bottom was impossible. Added: while carrying, a pointer within 64 px of the top or bottom of the viewport scrolls the
page (up to ~900 px/s, eased by depth), the held hammer keeps following the finger. Only active during a drag.

## Beats (seconds from impact; scene time is held for 0-1.5 like the pigeon egg, then resumes)
| t | what |
|---|---|
| 0.00 | Bonk: he squashes (scaleY .86 about his feet, 0.12 s), springs back with two wobbles; a burst of 4 lines and a ring of 3 stars circling his head; the hammer is resting on his head. |
| 0.00-1.40 | Dazed beat: stars circle, he sways +-2 deg. Sandwich stays in his hand (the existing sandwich wobble is part of the scene loop, which is held). |
| 1.40-2.40 | The street shakes (svg +-1.5 px) and a crack runs from the right edge to under his bar (stroke-dashoffset), small dust bits flick up along it. |
| 2.40-2.90 | The crack gapes into a dark pit under the parking stop (ellipse grows from a slit, lip highlight). Dust ring. He and the stop hang for 0.2 s (cartoon beat). `release()` fires: the hammer falls. |
| 2.90-3.50 | He and his stop drop into the pit (ease-in, slight tilt), clipped by the near lip so he sinks behind it. Dust cloud on landing, the cones jitter. |
| 3.50-4.40 | Silence, a few stars in the pit. |
| 4.40-5.80 | He climbs back out: three jerky heaves (up, slip, up) with the hat showing first; the stop rises with him. |
| 5.80-6.60 | Dust, the pit closes (ellipse shrinks back to a slit, crack fades). Overlay removed, scene resumes where it was held. |

Sitter and stop are moved by a `transform` attribute on `#o-sit` and `#o-bar` (they carry none of their own; SMIL is on
their children). Their cast shadows (`use href="#o-sit"`, `#o-bar`, and the ellipse at cx 504) are hidden for the gag.
The thermos and lunchbox stay put. The pusher is not in the pit (he is a moving target; one faller is the gag).

## Reset / replay
Busy flag. `reset()` removes the overlay, clears `transform` on `#o-sit`/`#o-bar`, un-hides shadows, unpauses. The hammer
lies on the page floor and can be picked up and dropped again. The pigeon egg (click) is blocked while the gag runs and
works unchanged otherwise.

## Reduced motion
`__bonk` is not created (same as the pigeon egg). The footer ledge behaviour is then unchanged from before.

## Not done / limits
- The sandwich wobble the brief asked for is not separate: `#o-sw` has its own SMIL transform that cannot be layered, so
  the sandwich simply stays with him through the squash.
- `__bonk.at(t)` is the harness: it draws second t of the gag with no timers (for screenshots and the GIF).
