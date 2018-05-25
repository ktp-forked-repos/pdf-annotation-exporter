// script to test exporting PDF text and images...

// page:
//   number
//   images=[] // images of configured sizes of the pages

// image
//
//   data: data URI of the image
//
//
// highlight
// rectangle
// note
//
//

// FIXME: pull out the highlighted words but ALSO pull out a screenshot with
// context as well the lines of text with context.   This way I can read more about
// what I was interested in at the time.
//
// - use vertical screenshot context only.
//
//


/**
 * Get the annotations from a specific page.
 */
function getAnnotations(page, extractionOptions) {

    // textAnnotation and highlightAnnotation

    var highlights = page.querySelectorAll(".annotationLayer .highlightAnnotation")
    console.log(highlights);

    var result = [];

    var highlightAnnotations = getAnnotationElements(page, "highlight");
    var squareAnnotations = getAnnotationElements(page, "square");
    var textAnnotations = getAnnotationElements(page, "text");

    console.log("Found text annotations: ", textAnnotations);

    // TODO: we can probably get all of these in one pass.
    var annotations
        = highlightAnnotations
        .concat(squareAnnotations)
        .concat(textAnnotations);

    for(var idx = 0; idx < annotations.length; ++idx) {
        var current = annotations[idx];

        var highlightElement = current.annotation;

        // console.log("highlightElement: ", highlightElement)

        var highlightRegion = toElementRegion(highlightElement);
        var highlightBox = regionToBox(highlightRegion);

        var highlightRegionWithScale = getScaledElementRegion(highlightElement);
        var highlightBoxWithScale = regionToBox(highlightRegionWithScale);

        if(isSkippable(page, highlightRegionWithScale)) {
            continue;
        }

        var comment = {};

        if (current.popup) {
            comment = parsePopupAnnotation(current.popup);
        }

        var image = null;
        var linesOfText = [];

        if (current.type !== 'text') {

            linesOfText = getHighlightLinesOfText(page, highlightBox, highlightBoxWithScale, comment, extractionOptions);

            if (! extractionOptions.noAnnotationImages && highlightRegion.area > 0) {
                image = getHighlightImage(page, highlightBoxWithScale);
            }

        }

        var highlight = createHighlight(highlightBox,
                                        linesOfText,
                                        image,
                                        highlightBoxWithScale,
                                        comment,
                                        current.type);

        result.push(highlight);

    }

    return result;

}

/**
 *  Return true if the given annotation is skippable
 *
 */
function isSkippable(page, highlightRegionWithScale) {

    var canvas = getPageCanvas(page);

    var canvasArea = canvas.offsetWidth * canvas.offsetHeight;

    var highlightArea = highlightRegionWithScale.width * highlightRegionWithScale.height;

    var coverage = highlightArea / canvasArea;

    // most annotations would never take up this much space so it must be a page
    // annotation
    return coverage > 0.9 || (highlightRegionWithScale.left === 0 && highlightRegionWithScale.top === 0);

}

// TODO: this could be more efficient by using an index of the offsets so that
// we only have to search within the offsets and dimensions that we're interested
// in.
function getHighlightLinesOfText(page, highlightBox) {
    
    var textElements = page.querySelectorAll(".textLayer div")

    // console.log("Working with textAnnotationBox: ", textAnnotationBox)

    var linesOfText = [];

    for(var idx = 0; idx < textElements.length; ++idx) {
        var textElement = textElements[idx];

        var elementRegion = toElementRegion(textElement);
        var elementBox = regionToBox(elementRegion);

        // console.log("textElement: ", textElement);
        // console.log("elementRegion: ", elementRegion);
        // console.log("elementBox: ", elementBox);

        if (isElementHighlighted(elementBox, highlightBox)) {
            // console.log("YES!: " + textElement.outerText);
            linesOfText.push(textElement.outerText);
        }

    }

    return linesOfText;

}

function parsePopupAnnotation(popupElement) {

    var dataElement = popupElement.querySelector(".popup")

    return {

        // TODO: might want to filter these for 
        author: Optional.of(dataElement.querySelector("h1")).map(function(element) {
            return element.textContent;
        }).getOrElse(null),
        
        text: Optional.of(dataElement.querySelector("p")).map(function(element) {
            return element.textContent;
        }).getOrElse(null)

    };

}

function getHighlightImage(page, highlightBox) {

    var canvas = getPageCanvas(page);

    var tmpCanvas = document.createElement("canvas");

    var destCtx = tmpCanvas.getContext('2d');

    var highlightRegion = boxToRegion(highlightBox);

    tmpCanvas.width  = highlightRegion.width;
    tmpCanvas.height = highlightRegion.height;

    // //call its drawImage() function passing it the source canvas directly
    destCtx.drawImage(canvas,
                      highlightRegion.left, highlightRegion.top, highlightRegion.width, highlightRegion.height,
                      0, 0, highlightRegion.width, highlightRegion.height );

    // toDataURL returns in 96DPI but we should return it in a higher
    // resolution I think however I guess a picture of text will just never
    // look appropriate 

    return {
        src: tmpCanvas.toDataURL('image/webp', 1.0),
        width: highlightRegion.width,
        height: highlightRegion.height
    };

}

function logImage(src) {
    console.log('%c       ', 'font-size: 100px; background: url(' + src + ') no-repeat;');
}

function getPageCanvas(page) {
    return page.querySelector("canvas");
}

function getImage(page) {
    var canvas = getPageCanvas(page);
    return canvas.toDataURL('image/webp', 1.0);
}

/**
 * Create an object with the bounding box of the text plus the text as an actual
 * array of lines.
 */
function createHighlight(box, linesOfText, image, highlightBoxWithScale, comment, type) {

    return {box: box, linesOfText: linesOfText, image: image, boxWithScale: highlightBoxWithScale, comment: comment, type: type};

}

// A region is like a box but based on left, top, width, height.
function createRegion(left, top, width, height) {
    var area = width * height;
    return {left: left, top: top, width: width, height: height, area: area};
}

// Take a region and convert it to a box.
function regionToBox(region) {
    return createBox(createPoint(region.left, region.top),
                     createPoint(region.left + region.width, region.top + region.height));
}

function boxToRegion(box) {
    return createRegion(box[0].x, box[0].y, box[1].x - box[0].x, box[1].y - box[0].y);
}

// create a tuple with two points
function createBox(point0, point1) {
    return [point0, point1];
}

// A euclidian point
function createPoint(x,y) {
    return {x: x, y: y};
}

function getScaledElementRegion(element) {

    // the width and height here are what we want and don't need to be scaled.
    var boundingClientRect = element.getBoundingClientRect();

    var scales = parseTransformScale(element.style.transform);

    var scaleX = scales[0];
    var scaleY = scales[1];

    return {left: element.offsetLeft * scaleX,
            top: element.offsetTop * scaleY,
            width: boundingClientRect.width,
            height: boundingClientRect.height };

}


function parseTransformScale(transform) {

    // element.style.transform

    // parseTransformScale("matrix(2.66667, 0, 0, 2.66667, 0, 0)");

    transform = transform.replace("matrix(", "");
    transform = transform.replace(")", "");

    var splitData = transform.split(", ")

    return [parseFloat(splitData[0]), parseFloat(splitData[3])];

}

function toElementRegionUsingOffset(element) {

    // TODO: I could return this just as a box.
    return createRegion(element.offsetLeft, element.offsetTop, element.offsetWidth, element.offsetHeight);
}


// Take an element and convert it to a box by using its offsets.
function toElementRegion(element) {

    var clientRect = element.getBoundingClientRect()

    // TODO: I could return this just as a box.
    return createRegion(clientRect.left, clientRect.top, clientRect.right - clientRect.left, clientRect.bottom - clientRect.top);
}

// return true if the element is highlighted
function isElementHighlighted(b0,b1) {

    return isOverlapped(b0, b1);

}

function assertTrue(value) {
    if (!value)
        throw Error();
}

function test() {

    var within = createBox(createPoint(0,0),createPoint(100,100));
    var box0 = createBox(createPoint(0,0),createPoint(100,100));

    assertTrue(isWithinBox(box0, within));

    var box1 = createBox(createPoint(10,10),createPoint(20,20));
    assertTrue(isWithinBox(box1, within));


}

function extractPage(page, extractionOptions) {

    var annotations = getAnnotations(page, extractionOptions);
    //var image = getImage(page);

    // TODO: no image for now because it's too much data. Make this an option
    // in the future.
    var image = null;

    return createPageExtract(annotations, image)

}

function createPageExtract(annotations, image) {
    return {annotations: annotations, image: image};
}

//
// textAnnotationRegion = {
//     left: 70,
//     top: 226.327,
//     width: 228.995,
//     height: 58.755
// };

/**
 * Get all annotations on the page for the given type and include their popup
 * annotations for extracting text from them.
 *
 * Types:
 *  - highlight   - text that is highlighted on the page. this also includes a form
 *                  of annotation that is a square rectangle that is highlighted.
 *  - square      - a rectangular region that is highlighted
 *  - text        - a small control with embedded text which is mostly hidden
 *
 * Return an array of objects which have annotation and popup params which are
 * elements referencing our data.
 */
function getAnnotationElements(page, type) {

    var clazz = type + "Annotation";

    var result = [];

    var annotationElements = page.querySelectorAll(".annotationLayer ." + clazz + ", .annotationLayer .popupAnnotation")

    for (var idx = 0; idx < annotationElements.length; ++idx) {

        var annotationElement = annotationElements[idx];

        if (annotationElement.getAttribute("class") === clazz) {

            var entry = { type: type, annotation: null, popup: null};
            entry.annotation = annotationElement;

            // now see if we have an associated popup by looking ahead to the
            // next annotation.

            var nextAnnotationElement = annotationElements[idx+1];

            if (nextAnnotationElement && nextAnnotationElement.getAttribute("class") === "popupAnnotation") {
                entry.popup = nextAnnotationElement.querySelector(".popupWrapper");
            }

            // for square annotations, they have the popupWrapper internally..
            // which is annoying and confusing.

            if ( ! entry.popup ) {
                entry.popup = annotationElement.querySelector(".popupWrapper");
            }

            result.push(entry);

        }

    }

    return result;

}

function doExtraction(extractionOptions) {

    result = {
        pages: []
    };

    var pages = document.querySelectorAll(".page");

    for(var idx = 0; idx < pages.length; ++idx) {
        var page = pages[idx];

        var canvas = getPageCanvas(page);
        if (! canvas)
            continue;

        var pageExtract = extractPage(page, extractionOptions);
        result.pages.push(pageExtract);

    }

    return result;
    
}



// FIXME: I now need to tell the rendered to go through and render all the pages
// and use promises as it doesn't actually do this by itself.

// FIXME: current problems:
//
// we don't properly limit the range of teh text BEFORE our highlight.  This was
// not actually WHAT we highlighted.  I'm going to have to figure out how to do
// that..  it might not be proossible. ALSO the last div isn't shown.   
//
//           "linesOfText": [
//             "ous transactions. We show that this is a sensible tradeoff,",
//             "and that resulting system is sufficient for building com-"
//           ],
//
// I'm going to have to use the lettering plugin for this to get the position
// of each letter:
//
//   https://daverupert.com/2010/09/lettering-js/

function createExtractionOptions() {
    return {noPageImages: false, noAnnotationImages: false};
}

//var result = doExtraction(createExtractionOptions());

//console.log(JSON.stringify(result, null, "  "));

