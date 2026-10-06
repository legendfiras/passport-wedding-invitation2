# Art direction and motion

The visual thesis is a tactile travel keepsake: midnight navy leather, aged ivory cotton paper, antique gold foil, sepia watercolor, generous calligraphy and ticket perforations. Materials and the unfolding object carry the story.

Palette: navy `#061d2d`, deep navy `#041521`, ivory `#f2e8d2`, antique paper `#eee1c5`, gold `#c9ad76`, ink `#292a29`. Pinyon Script carries the names and romantic headings; Cormorant Garamond carries information. The monogram is **D & JC**, with a smaller raised ampersand.

## Opening

1. Show the closed navy passport fully visible and centered on the first paint.
2. Keep normal document scrolling available; there is no envelope, overlay, glow, or pre-opening delay.
3. Start music from the passport-opening tap when the browser permits it, while keeping the persistent music control available.
4. Turn the cover using independent front and back faces and shift the book's centre as the left page opens.
5. Carry that same book underneath the revealed names using a FLIP transform.

The passport opening uses transforms only and begins immediately from the user tap. No video, envelope artwork, particle canvas, or asset-readiness gate participates in the opening. Scroll updates schedule one animation frame, calculate a real curve position and tangent, then move/rotate the airplane along the curve.

## Generated artwork and prompts

Two standalone assets were generated with **built-in ImageGen**, one request per asset, using both supplied reference images. Both were inspected for text, perspective and face defects. All names and wording remain editable HTML.

**passport-cover.png:** flat orthographic 2:3 closed-passport front, full-bleed dark navy pebbled leather, fine inset gold stitching, antique-gold embossed globe and laurel crest matching the reference. Slightly rounded corners. No words, letters, numbers, monogram, flowers, envelope or backdrop. Reserve empty upper/lower areas for editable passport title, D & JC and date.

**passport-spread.png:** flat continuous 2:1 ivory passport artwork with fine antique cotton paper grain. Left half: sepia watercolor Mediterranean harbour, palms, villa and tiny sailboat. Right half: soft beige antique world map and subtle compass at lower right. The reference's open passport is the composition target. No physical book edges, spine, perspective, text, numbers, names, plane, flight line or photographic faces. Keep upper and lower areas light for editable copy.

The church, party, ticket airplane and coastline artwork reuse the supplied reference via CSS crop windows. Real couple photographs require the correct supplied images; the story frames are marked placeholders.
