/**
 * Cursor-following object labels.
 *
 * Progressive enhancement: without this script every object is still a real
 * `<a>`, and its label appears on hover and focus through CSS alone. With it,
 * the label detaches into a single floating element that tracks the pointer,
 * and the per-object labels are suppressed.
 *
 * One label element per room, reused — creating and destroying nodes on every
 * pointer move would be needless churn.
 */

(function () {
  "use strict";

  var stage = document.querySelector(".room-stage");
  if (!stage) return;

  /* ---------- hitbox overlay ---------- */

  /**
   * `?hitboxes` outlines every clickable region, so an author can see where
   * they actually are without guessing from the coordinates. An authoring aid:
   * it costs nothing when the parameter is absent, and never ships enabled.
   *
   * Polygons are drawn as their true outline rather than their bounding box —
   * seeing the box would defeat the point of drawing a polygon.
   */
  if (/[?&]hitboxes\b/.test(location.search)) {
    var frame = stage.querySelector(".room-frame");
    if (frame) {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "room-hitboxes");
      // A 0-100 viewBox means hotspot percentages are usable as-is, and
      // `preserveAspectRatio="none"` stretches that square onto the real frame.
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");

      var spots = stage.querySelectorAll(".hotspot");
      for (var i = 0; i < spots.length; i++) {
        var spot = spots[i];
        var outline = spot.getAttribute("data-points");
        var shape;
        if (outline) {
          shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
          shape.setAttribute("points", outline);
        } else {
          shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          shape.setAttribute("x", parseFloat(spot.style.left) || 0);
          shape.setAttribute("y", parseFloat(spot.style.top) || 0);
          shape.setAttribute("width", parseFloat(spot.style.width) || 0);
          shape.setAttribute("height", parseFloat(spot.style.height) || 0);
        }
        // Strokes would scale with the stretched viewBox and go lopsided.
        shape.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(shape);
      }
      frame.appendChild(svg);
      stage.setAttribute("data-hitboxes", "1");
    }
  }

  /* ---------- cursor label ---------- */

  var label = document.createElement("span");
  label.className = "room-cursor-label";
  label.setAttribute("aria-hidden", "true");
  stage.appendChild(label);

  // Tell the stylesheet to stop showing the per-object labels on hover.
  stage.setAttribute("data-cursor-labels", "1");

  /** Distance from the cursor to the label's corner. */
  var OFFSET_X = 14;
  var OFFSET_Y = 16;

  var current = null;
  var pending = null;

  /**
   * Place the label near the pointer, flipping it when it would overflow the
   * stage so it never gets clipped at an edge.
   */
  function position(clientX, clientY) {
    var box = stage.getBoundingClientRect();
    var x = clientX - box.left + OFFSET_X;
    var y = clientY - box.top + OFFSET_Y;

    // `offsetWidth` is only meaningful once the label has text and is laid out.
    var w = label.offsetWidth;
    var h = label.offsetHeight;
    if (x + w > box.width) x = clientX - box.left - w - OFFSET_X;
    if (y + h > box.height) y = clientY - box.top - h - OFFSET_Y;

    label.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  function show(hotspot, event) {
    var text = hotspot.querySelector(".hotspot-label");
    label.textContent = text ? text.textContent : "";
    label.setAttribute("data-visible", "1");
    current = hotspot;
    position(event.clientX, event.clientY);
  }

  function hide() {
    current = null;
    label.removeAttribute("data-visible");
  }

  /** Clear both floating labels when the pointer leaves the room entirely. */
  function hideAll() {
    hide();
    if (probe) probe.removeAttribute("data-visible");
  }

  stage.addEventListener("pointerover", function (event) {
    // Ignore touch: there is no hover, and the tap navigates anyway.
    if (event.pointerType === "touch") return;
    var hotspot = event.target.closest(".hotspot");
    if (hotspot && hotspot !== current) show(hotspot, event);
  });

  stage.addEventListener("pointerout", function (event) {
    if (event.pointerType === "touch") return;
    var hotspot = event.target.closest(".hotspot");
    if (!hotspot) return;
    // Moving between an object's own children is not leaving it.
    if (event.relatedTarget && hotspot.contains(event.relatedTarget)) return;
    hide();
  });

  /* ---------- ?position readout ---------- */

  /**
   * `?position` reports the cursor's location in the background image's own
   * pixels, beside the pointer. Paired with `?hitboxes` it is how you place an
   * object: read the coordinates off the image, write them into the note.
   *
   * Coordinates are the image's native pixels — the same unit as
   * `size: absolute` — with the percentage shown alongside, since that is what
   * the markdown takes by default.
   */
  var showPosition = /[?&]position\b/.test(location.search);
  var probe = null;
  var roomFrame = stage.querySelector(".room-frame");

  if (showPosition && roomFrame) {
    probe = document.createElement("span");
    probe.className = "room-cursor-label room-position";
    probe.setAttribute("aria-hidden", "true");
    stage.appendChild(probe);
  }

  /** Update the coordinate readout for a pointer position. */
  function reportPosition(clientX, clientY) {
    if (!probe || !roomFrame) return;
    var frameBox = roomFrame.getBoundingClientRect();
    if (!frameBox.width || !frameBox.height) return;

    // Percentages of the frame, which is exactly the image's box.
    var px = ((clientX - frameBox.left) / frameBox.width) * 100;
    var py = ((clientY - frameBox.top) / frameBox.height) * 100;

    // Outside the image there is nothing meaningful to report.
    if (px < 0 || py < 0 || px > 100 || py > 100) {
      probe.removeAttribute("data-visible");
      return;
    }

    var nativeW = parseFloat(roomFrame.getAttribute("data-width"));
    var nativeH = parseFloat(roomFrame.getAttribute("data-height"));
    var text = px.toFixed(1) + "%, " + py.toFixed(1) + "%";
    if (nativeW && nativeH) {
      text =
        Math.round((px / 100) * nativeW) +
        ", " +
        Math.round((py / 100) * nativeH) +
        " px  (" +
        text +
        ")";
    }
    probe.textContent = text;
    probe.setAttribute("data-visible", "1");

    var box = stage.getBoundingClientRect();
    var x = clientX - box.left + OFFSET_X;
    var y = clientY - box.top - probe.offsetHeight - OFFSET_Y;
    if (x + probe.offsetWidth > box.width) {
      x = clientX - box.left - probe.offsetWidth - OFFSET_X;
    }
    // Sits above the cursor so it never collides with the object label below.
    if (y < 0) y = clientY - box.top + OFFSET_Y;
    probe.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  var lastX = 0;
  var lastY = 0;

  stage.addEventListener("pointermove", function (event) {
    if (event.pointerType === "touch") return;
    if (!current && !probe) return;
    // Record the latest position, then coalesce to one reposition per frame:
    // pointermove fires far faster than the display refreshes. The coordinates
    // are kept outside the callback so a frame always uses the newest ones,
    // not those of whichever event happened to schedule it.
    lastX = event.clientX;
    lastY = event.clientY;
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      if (current) position(lastX, lastY);
      reportPosition(lastX, lastY);
    });
  });

  // Leaving the room entirely, or scrolling it away, must clear the label.
  stage.addEventListener("pointerleave", hideAll);
  window.addEventListener("blur", hideAll);
})();
