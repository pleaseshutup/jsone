# jsone
JSON Editor with configurable editing, validation and documentation.
Great for providing an easy guided way to edit JSON files or view JSON from an API.
Written in vanilla javascript and dependency free and runs in the browser.

### Usage
``` javascript
var demo = new jsone({
    node: document.getElementById('jsone'),
    json: 'demoJSON.json',
    schema: 'demoSchema.json'
});
```

### Config
``` javascript
{
"node": "", // the html element to populate with the jsone ui
"json": "", // a javascript object or the URL to the JSON file to use
"schema": "" // a javascript object or the URL to the JSON file to use as the schema/rules for the JSON file
}

### Local Dev/Local Demo
Needs to run on localhost for XMLHttpRequest to grab files from the local disk.

``` sh
python -m SimpleHTTPServer 8080
http://localhost:8080/demo.html
```
