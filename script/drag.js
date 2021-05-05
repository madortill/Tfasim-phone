const TRANSITION_TIME = 1000;
window.addEventListener("load", function init() {
    document.querySelectorAll(".droppable").forEach(droppable);
    window.addEventListener("blur", dropItem);

    if ('ontouchstart' in window) {
        window.addEventListener("touchmove", drag, {passive: false});
        window.addEventListener("touchend", dropItem, {passive: false});
        window.addEventListener("touchcancel", dropItem, {passive: false});
    } else {
        window.addEventListener("pointermove", drag, {passive: false});
        window.addEventListener("pointerup", dropItem, {passive: false});
    }
});

function stashStyle(el, passive) {
    if (!el.oldStyles) el.oldStyles = [];
    el.oldStyles.push(el.style.cssText);
    if (!passive)
        el.style.cssText = "";
}

function unstashStyle(el) {
    if (!el.oldStyles) return;
    el.style.cssText = el.oldStyles.pop();
    if (!el.oldStyles.length) el.oldStyles = undefined;
}

/**
 * 
 * @param {HTMLElement} el 
 * @param {stirng} string
 * @param {string} string
 */
function droppable(el, { drop, fail }) {
    if (!el) console.error(`illegal parameter given to droppable function: ${el}`);
    if (drop || el.hasAttribute("ondrop"))
        el.dropped = typeof drop === "function" ? drop :new Function(drop || el.getAttribute("ondrop"));
    if (fail || el.hasAttribute("onfail"))
        el.failed = typeof fail === "function" ?fail: new Function(fail || el.getAttribute("onfail"));
    if (!('ontouchstart' in window)) {
        el.addEventListener("pointerdown", dragStart, {passive: false});
        el.addEventListener("dragstart", e => e.preventDefault(), {passive: false});
    } else
        el.addEventListener("touchstart", dragStart, {passive: false});
}

/**
 * 
 * @param {TouchEvent | PointerEvent} e 
 */
function dragStart(e) {
    e.preventDefault();
    if (e.target.locked) return;

    window.dragged = e.target;
    stashStyle(window.dragged, true);
    let obsolute = boolAttr(window.dragged, "removeondrag");
    if ((!obsolute && !boolAttr(window.dragged, "removeonplace")) || !window.dragged.originBounds) {
        window.dragged.style.top = "unset";
        window.dragged.style.left = "unset";
    }
    window.dragged.style.right = "unset";
    window.dragged.style.bottom = "unset";
    window.dragged.oldTransform = window.dragged.style.transform;

    /**
     * @type {DOMRect}
     */
    let bounds = window.dragged.getBoundingClientRect();

    let point = e instanceof TouchEvent ? e.touches[0] : event;
    window.dragged.dragLocation = {
        x: (point.clientX - bounds.x) / bounds.width,
        y: (point.clientY - bounds.y) / bounds.height
    }

    let parentOffset = window.dragged.offsetParent;
    let offsetBounds = parentOffset.getBoundingClientRect();

    if (!window.dragged.originBounds) {
        window.dragged.originBounds = bounds;
        if (obsolute) {
            window.dragged.style.position = "absolute"
            void window.dragged.clientHeight;
            //matrix...
            window.dragged.style.left = `${bounds.x - offsetBounds.x}px`;
            window.dragged.style.top = `${bounds.y - offsetBounds.y}px`;
        }
    }
}
/**
 * 
 * @param {TouchEvent | PointerEvent} e 
 */
function drag(e) {
    if (!window.dragged) return;
    e.preventDefault();
    window.dragged.beenDragged = true;
    /**
     * @type {HTMLElement}
     */
    let el = window.dragged;
    let x, y;
    if (el.hasAttribute("drag-origin")) {
        [x, y] = el.getAttribute("drag-origin").split(",");
        [x, y] = [x / 100, y / 100];
    } else
        [x, y] = [window.dragged.dragLocation.x, window.dragged.dragLocation.y];

    for (let point of e.touches || [e]) {
        //matrix...
        el.style.transform = `translate(${point.clientX - el.clientWidth * x - window.dragged.originBounds.x}px, ${point.clientY - el.clientHeight * y - window.dragged.originBounds.y}px)`
    }
}

DOMRect.prototype.contains = function contains({ x, y }) {
    return this.top <= y && this.bottom >= y && this.left <= x && this.right >= x;
}

/**
 * 
 * @param {TouchEvent | PointerEvent | Event} event 
 */
function dropItem(event) {
    if (!window.dragged) return;
    /**
     * @type {HTMLElement & {
     *  beenDragged: boolean
     *  dropped: function(this: HTMLElement, el: HTMLElement): void
     *  failed: function(this: HTMLElement, el: HTMLElement): void
     *  anchor: HTMLElement & {anchored: HTMLElement[]}
     *  locked: boolean
     * }}
     */
    let dragged = window.dragged;
    window.dragged = undefined;
    let failed = true;
    let beenDragged = dragged.beenDragged;
    dragged.beenDragged = undefined;
    /**
     * @type {typeof dragged.anchor}
     */
    let lastTarget = document.body;
    if (event instanceof TouchEvent || event instanceof PointerEvent)
        for (let target of document.querySelectorAll(".target")) {
            for (let touch of event.changedTouches || [event]) {
                var point = { x: touch.clientX, y: touch.clientY };
                if (target.getBoundingClientRect().contains(point)) {
                    lastTarget = target;
                    if (attr(target, "for", dragged.id).split(/, ?/).indexOf(dragged.id) !== -1) {
                        failed = false;
                        if (!target.classList.contains("reset") && dragged.dropped) dragged.dropped.call(target, dragged);
                    }
                    break;
                }
            }
        }
    if (failed && dragged.failed && beenDragged) dragged.failed.call(dragged);

    dragged.originBounds = undefined;
    if (!failed && lastTarget.classList.contains("reset")) {
        while (dragged.oldStyles)
            unstashStyle(dragged);
        if (dragged.anchor && boolAttr(dragged, "centered")) {
            let anchor = dragged.anchor;
            anchor.anchored = anchor.anchored.filter(el => el !== dragged);
            if (anchor.anchored.length)
                anchor.anchored.filter(el => boolAttr(el, "centered")).forEach(positionEl.bind(this, anchor.getBoundingClientRect()));
            else
                anchor.anchored = undefined;
            dragged.anchor = undefined;
        }
        return;
    }


    if (!failed && boolAttr(dragged, "anchored")) {
        if (!lastTarget.anchored) lastTarget.anchored = [];
        lastTarget.anchored.push(dragged);
        if (boolAttr(dragged, "centered")) {
            if (dragged.anchor !== lastTarget) {
                if (dragged.anchor) {
                    let prevAnchor = dragged.anchor;
                    prevAnchor.anchored = prevAnchor.anchored.filter(el => el !== dragged);
                    if (prevAnchor.anchored.length)
                        prevAnchor.anchored.filter(el => boolAttr(el, "centered")).forEach(positionEl.bind(this, prevAnchor.getBoundingClientRect()));
                    else
                        prevAnchor.anchored = undefined;
                }
                lastTarget.anchored.filter(el => boolAttr(el, "centered")).forEach(positionEl.bind(this, lastTarget.getBoundingClientRect()));
                dragged.anchor = lastTarget;
            } else
                unstashStyle(dragged);
        }
        if (boolAttr(dragged, "removeonplace")) {
            let bounds = dragged.getBoundingClientRect();
            dragged.originBounds = bounds;
            dragged.style.position = "absolute";
            //matrix...?
            dragged.style.left = `${bounds.x}px`;
            dragged.style.top = `${bounds.y}px`;
            dragged.style.transform = "translate(0, 0)";
        } else if (boolAttr(dragged, "removeondrag")) {
            dragged.style.position = "";
            let bounds = dragged.getBoundingClientRect();
            dragged.style.left = "";
            dragged.style.top = "";
            //matrix...?
            dragged.style.transform = `translate(${bounds.x}px, ${bounds.y})`;
        }
        dragged.locked = boolAttr(dragged, "lockachored");
    } else {
        if (boolAttr(dragged, "failanimation")) {
            dragged.style.transition += `${dragged.style.transition.length ? ", " : ""}${TRANSITION_TIME / 1000.}s transform`;
            /**
             * @todo store og transform 
             */
            dragged.style.transform = dragged.oldTransform;
            dragged.locked = true;
            setTimeout(() => {
                unstashStyle(dragged);
                dragged.locked = false;
            }, TRANSITION_TIME);
        } else
            unstashStyle(dragged);
    }
}

function positionEl(targetBounds, el, i, all) {
    var x, y;
    if (el.hasAttribute("drag-origin")) {
        [x, y] = el.getAttribute("drag-origin").split(",");
        [x, y] = [x / 100, y / 100];
    } else
        [x, y] = [.5, .5];
    //matrix...?
    let point = { x: targetBounds.x + targetBounds.width * (i + 1) / (all.length + 1), y: targetBounds.y + targetBounds.height / 2 }
    el.style.transform = `translate(${point.x - el.clientWidth * x - el.originBounds.x}px, ${point.y - el.clientHeight * y - el.originBounds.y}px)`;
}
/**
 * 
 * @template {HTMLElement} T  
 * @param {T} el 
 * @param {string} name 
 * @param {string} def
 * @returns {string}
 */
function attr(el, name, def) {
    return (el.hasAttribute(name) && el.getAttribute(name)) || def;
}

/**
 * 
 * @template {HTMLElement} T 
 * @param {T} el
 * @param {string} name 
 * @returns {boolean}
 */
function boolAttr(el, name) {
    return el.hasAttribute(name) && el.getAttribute(name) !== "false";
}