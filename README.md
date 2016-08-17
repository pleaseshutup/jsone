# jsone
JSON Editor with configurable editing, validation and documentation.
Great for providing an easy guided way to edit and view JSON.

This project is under heavy development. Do not adopt yet.

### Basic Usage
``` javascript

var demo = new jsone({
    node: document.getElementById('jsone'), // target html element to place jsone
    json: 'demoJSON.json', // js object or url to jsone file
    schema: 'demoSchema.json' // js object or url to schema file
});

demo.on('change', function(path){
    console.log('change to path', path);

    Object.keys(demo.getChanges()).forEach(function(changedPath, ar){
        console.log('path', changedPath, 'changed to', ar[changedPath])
    })
})



```

### Config Options
``` javascript
{
    "node": "", // the html element to populate with the jsone ui
    "json": "", // a javascript object or the URL to the JSON file to use
    "schema": "", // a javascript object or the URL to the JSON file to use as the schema/rules for the JSON file
    "hashNavigation": false, // (boolean) use window.locaton.hash to provide browser history back/foward
    "url_replace": {}, // (object) a key/value object of replace from/replace to strings for URL's which is handy for local dev testing schema's
}
```

### Events
| name | arguments | description |
| --- | --- | --- |
| error | error object | there is an error of any kind
| init | null | jsone is initialized and is going to try to get the schema/json files
| schemaready | null | the schema and all referenced schema's are loaded and ready
| jsonready | null | the JSON is loaded and the schema is associated with it
| change | pathstring, value | when a change is made this event emits the path as a string delimited by "/" to the changed node
| autofix | pathstring, value, change object | when a json file node type is different than the schema type it is automatically fixed and this event is fired for every node that is fixed

### Methods
| name | arguments | description |
| --- | --- | --- |
| on | event, callback | executes call back on the specified event
| getChanges | null | returns an object where each key is the path to the highest level containing node change and the value of that node 
| json | json url or javascript object | change the active json file
| schema | schema url or javascript object | change the active schema file


### Schema Support
The schema's used with jsone try to conform to the jsone schema spec at http://json-schema.org/ and use the same structure of properties, items, definitions and references. It should be compatible with the structure starting now and feature gaps will be filled over time.

### Local Dev/Local Demo
Needs to run on localhost for XMLHttpRequest to grab files from the local disk.

``` sh
python -m SimpleHTTPServer 8080
http://localhost:8080/demo.html
```


#### jsone
Pronounced "jase own" and is a play off "json for everyone" or "jsone editor" as it fills both needs.


#### License
MIT
