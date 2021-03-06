// convert an annotations json export to html for debug (and other) purposes

fs = require('fs')

var path = process.argv[2]

fs.readFile(path, 'utf8', function (err,data) {

    if (err) {
        return console.log(err);
    }

    var obj = JSON.parse(data)

    console.log(`
    <style>
        .annotation {
            margin: 10px;
            border: 1px solid black;
            padding: 10px;            
        }
        
        blockquote {

            margin-left: 0.5em;
        
            border-style: none;
            padding-left: 0.5em;
            border-left-style: solid;
            border-left-width: 1px;
            border-left-color: #00B229;
        
        }

    </style>
    `);

    obj.pages.forEach(function(page) {

        if (page.annotations.length > 0) {

            page.annotations.forEach(function(annotation) {

                console.log("<div class='annotation'>")
                console.log("<div class=''>type: %s</div>", annotation.type);

                if (annotation.image && annotation.image.src !== "") {
                    console.log(`<img src="%s" width="%s" height="%s">`, annotation.image.src, annotation.image.width, annotation.image.height);
                }

                console.log(`<br><b>lines of text:</b><br>`);

                console.log(`<blockquote>%s</blockquote>`, annotation.linesOfText.join("\n<br>"));

                console.log(`<br><b>comment:</b><br>`);
                console.log("<blockquote>%s</blockquote>", annotation.comment.text);

                console.log("</div>")

            } );

            console.log("<hr>");

        }

    });


});
