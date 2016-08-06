(function(root){
	"use strict"

	var jsone = function(config){
		var self = this;

		self.__config = config || {};
		self.__node = config.node || document.querySelector(config.node) || document.getElementById('jsone') || document.body;

		self.json = function(json){
			if(!json){ self.initJSON(); return false; }
			if(typeof json === 'object'){
				self.__json = json;
				self.initJSON();
			} else {
				__mdd.prototype.http(json, function(json){
					if(!json){ console.error('JSONE: Could not load json', json); }
					self.json(json);
				});
			}
		}

		self.initJSON = function(){
			self.loopJSON(self.__json, [], function(node, path, type){
				self.renderNode(node, path, type);
			});
			console.log('json', self.__json, self.__config);
		}

		self.schema = function(schema){
			if(!schema){ self.initSchema(); return false; }
			if(typeof schema === 'object'){
				self.__schema = schema;
				self.initSchema();
			} else {
				__mdd.prototype.http(schema, function(schema){
					if(!schema){ console.error('JSONE: Could not load schema', schema); }
					self.schema(schema);
				});
			}
		}
		self.initSchema = function(){
			console.log('schema', self.__schema, self.__config);
		}

		self.json(self.__config.json || self.__config.json);
		self.schema(self.__config.schema || self.__config.schema);

		self.loopJSON = function(node, path, func){
			var type = type = Array.isArray(node) ? 'array' : typeof node;

			if(path.length){
				func(node, path, type);
			}

			if(type === 'object' || type === 'array'){
				for(var k in node){
					self.loopJSON(node[k], path.concat(k), func);
				}
			}
		}
		self.renderNode = function(node, path, type){
			var indent = path.length-1, joinpath = path.join('/'),
				css = {
					'padding-left': (indent*20) + 'px',
					display: indent > 0 ? 'none' : 'block'
				};
			var row = mdd().new('section').html('path: '+joinpath).css(css).attr({'data-parent-path': path.slice(0, -1).join('/'), 'data-path': joinpath}).appendTo(self.__config.node).on('click', function(e){
				if(type === 'object' || type === 'array'){
					if(row.expanded){
						self.__nodemdd.find('section[data-parent-path="'+joinpath+'"]').css({display: 'none'});
						row.expanded = false;
					} else {
						self.__nodemdd.find('section[data-parent-path="'+joinpath+'"]').css({display: 'block'});
						row.expanded = true;
					}
				}
			});
		}
		self.__node.classList.add('jsone');
		self.__nodemdd = mdd(self.__node);

		__mdd.prototype.stylesheet({
			'.jsone section:hover': {
				'background-color': 'red'
			}
		}, 'json-sheet');

		return this;
	};


	/* dom utils == mini dandom == mdd */
	if(!window.__mdd){
		window.__mdd = function(sel, target){
			this.__mdd = true;
			if(typeof sel === 'object'){
				this.elements = sel.__mdd ? sel : [sel];
			} else if(sel){
				this.elements = [].slice.call((target ? target.__mdd ? target.elements[0] : target : document).querySelectorAll(sel))
			}
			return this;
		}
		__mdd.prototype.on = function(eventNames, execFunc){
			var self = this;
			eventNames.split(/[\s,]+/).forEach(function(eventName) {
				if (eventName) {
					self.elements.forEach(function(element) {
						element.addEventListener(eventName, execFunc);
					});
				}
			});
			return this;
		}
		__mdd.prototype.find = function(sel){
			return new __mdd(sel, this);
		}
		__mdd.prototype.new = function(type){
			this.elements = [document.createElement(type)];
			return this;
		}
		__mdd.prototype.css = function(css){
			this.elements.forEach(function(element) {
				for (var K in css) {
					element.style.setProperty(K, css[K] + '');
				}
			});
			return this;
		}
		__mdd.prototype.attr = function(attr){
			this.elements.forEach(function(element) {
				for (var K in attr) {
					element.setAttribute(K, attr[K]);
				}
			});
			return this;
		}
		__mdd.prototype.appendTo = function(target){
			var self = this;
			var targ = target.elements || [target];
			targ.forEach(function(targetElement) {
				self.elements.forEach(function(element){
					targetElement.appendChild(element);
				})
			});
			return this;
		}
		__mdd.prototype.text = function(text){
			this.elements.forEach(function(element){
				element.textContent = text;
			});
			return this;
		}
		__mdd.prototype.html = function(html){
			this.elements.forEach(function(element){
				element.innerHTML = html;
			});
			return this;
		}
		__mdd.prototype.stylesheet = function(sheet, id){
			if( typeof sheet === 'object' ){
				var stylesheet = '';
				Object.keys(sheet).forEach(function(selector){
					stylesheet += selector + ' { ';
					Object.keys(sheet[selector]).forEach(function(property){
						stylesheet += property + ':' + sheet[selector][property];
					});
					stylesheet += ' } ';
				});
				sheet = stylesheet;
			}
			var head = document.head || document.getElementsByTagName('head')[0],
				style = document.getElementById(id) || document.createElement('style');
			style.type = 'text/css';
			if (style.styleSheet) {
				style.styleSheet.cssText = sheet;
			} else {
				style.appendChild(document.createTextNode(sheet));
			}
			head.appendChild(style);

		}
		__mdd.prototype.http = function(){
			var config = {}, url, callback, ret;
			for (var i = arguments.length - 1; i >= 0; i--) {
				if(typeof arguments[i] === 'object'){
					config = arguments[i];
				} else if(typeof arguments[i] === 'string'){
					url = arguments[i];
				} else if(typeof arguments[i] === 'function'){
					callback = arguments[i];
				}
			}
			config.type = config.type || config.data ? 'POST' : 'GET';
			config.url = url || config.url || '';
			config.callback = callback || config.callback || function(){};
			config.data = config.data || '';

			var request = new XMLHttpRequest();
			request.open(config.type, config.url, true);
			request.timeout = config.timeout || 5000;
			request.onload = function() {
				ret = false;
				if (request.status >= 200 && request.status < 400) {
					ret = request.responseText;
				}
				if (config.json || config.url.substr(-5) === '.json') {
					try {
						ret = JSON.parse(request.responseText);
					} catch (e) {
						console.error(e);
						ret = false;
					}
				}
				config.callback(ret);
			};
			request.onerror = function() {
				config.callback(false);
			};
			request.ontimeout = function() {
				config.callback(false);
			};
			request.send(config.data);
		}
	}
	var mdd = function(sel, target){ return new __mdd(sel, target); }

	root.jsone = jsone;
	return this;
})(window);
