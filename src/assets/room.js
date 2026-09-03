(function () {
    "use strict";
    var stage = document.querySelector(".room-stage");
    if (!stage)
        return;
    if (/[?&]hitboxes\b/.test(location.search)) {
        var frame = stage.querySelector(".room-frame");
        if (frame) {
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "room-hitboxes");
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
                }
                else {
                    shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    shape.setAttribute("x", parseFloat(spot.style.left) || 0);
                    shape.setAttribute("y", parseFloat(spot.style.top) || 0);
                    shape.setAttribute("width", parseFloat(spot.style.width) || 0);
                    shape.setAttribute("height", parseFloat(spot.style.height) || 0);
                }
                shape.setAttribute("vector-effect", "non-scaling-stroke");
                svg.appendChild(shape);
            }
            frame.appendChild(svg);
            stage.setAttribute("data-hitboxes", "1");
        }
    }
    var label = document.createElement("span");
    label.className = "room-cursor-label";
    label.setAttribute("aria-hidden", "true");
    stage.appendChild(label);
    stage.setAttribute("data-cursor-labels", "1");
    var OFFSET_X = 14;
    var OFFSET_Y = 16;
    var current = null;
    var pending = null;
    function position(clientX, clientY) {
        var box = stage.getBoundingClientRect();
        var x = clientX - box.left + OFFSET_X;
        var y = clientY - box.top + OFFSET_Y;
        var w = label.offsetWidth;
        var h = label.offsetHeight;
        if (x + w > box.width)
            x = clientX - box.left - w - OFFSET_X;
        if (y + h > box.height)
            y = clientY - box.top - h - OFFSET_Y;
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
    function hideAll() {
        hide();
        if (probe)
            probe.removeAttribute("data-visible");
    }
    stage.addEventListener("pointerover", function (event) {
        if (event.pointerType === "touch")
            return;
        var hotspot = event.target.closest(".hotspot");
        if (hotspot && hotspot !== current)
            show(hotspot, event);
    });
    stage.addEventListener("pointerout", function (event) {
        if (event.pointerType === "touch")
            return;
        var hotspot = event.target.closest(".hotspot");
        if (!hotspot)
            return;
        if (event.relatedTarget && hotspot.contains(event.relatedTarget))
            return;
        hide();
    });
    var showPosition = /[?&]position\b/.test(location.search);
    var probe = null;
    var roomFrame = stage.querySelector(".room-frame");
    if (showPosition && roomFrame) {
        probe = document.createElement("span");
        probe.className = "room-cursor-label room-position";
        probe.setAttribute("aria-hidden", "true");
        stage.appendChild(probe);
    }
    function reportPosition(clientX, clientY) {
        if (!probe || !roomFrame)
            return;
        var frameBox = roomFrame.getBoundingClientRect();
        if (!frameBox.width || !frameBox.height)
            return;
        var px = ((clientX - frameBox.left) / frameBox.width) * 100;
        var py = ((clientY - frameBox.top) / frameBox.height) * 100;
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
        if (y < 0)
            y = clientY - box.top + OFFSET_Y;
        probe.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    }
    var lastX = 0;
    var lastY = 0;
    stage.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch")
            return;
        if (!current && !probe)
            return;
        lastX = event.clientX;
        lastY = event.clientY;
        if (pending)
            return;
        pending = requestAnimationFrame(function () {
            pending = null;
            if (current)
                position(lastX, lastY);
            reportPosition(lastX, lastY);
        });
    });
    stage.addEventListener("pointerleave", hideAll);
    window.addEventListener("blur", hideAll);
})();
